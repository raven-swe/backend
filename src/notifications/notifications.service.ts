import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';
import { NotificationTriggerOptions } from './interfaces/notification-trigger.interface';
import { NOTIFICATIONS_ERROR_CODES, NOTIFICATIONS_ERROR_MESSAGES } from './constants';
import { NotificationCursor } from 'src/common/interfaces';
import { decodeCompositeCursor, paginateComposite } from 'src/common/utils';
import { PAGINATION_ERROR_CODES, PAGINATION_ERROR_MESSAGES } from 'src/common/constants';
import { SseEventsService } from 'src/sse/sse-events.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { UsersRepository } from 'src/users/users.repository';
import { NotificationPayloadDto } from './dtos/notification-payload.dto';
import { DEFAULT_PROFILE_PICTURE } from 'src/users/constants';
import { Prisma } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private generateDedupeKey(
    options: NotificationTriggerOptions,
    additional?: { replyToTweetId?: bigint; quoteToTweetId?: bigint },
  ): string {
    switch (options.type) {
      case 'FOLLOW':
        return `${options.type}:USER:${options.receiverId}`;
      case 'QUOTE':
        return `${options.type}:TWEET:${additional?.quoteToTweetId}`;
      case 'MENTION':
        return `${options.type}:${options.actorId}:${options.receiverId}:${options.tweetId}`;
      case 'REPLY':
        return `${options.type}:TWEET:${additional?.replyToTweetId}`;
      case 'LIKE':
      case 'RETWEET':
      case 'TWEET':
      case 'MESSAGE':
        return `${options.type}:TWEET:${options.tweetId}`;
    }
  }
  private readonly logger = new Logger(NotificationsService.name);
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly sseEvents: SseEventsService,
    private readonly usersRepository: UsersRepository,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  async trigger(options: NotificationTriggerOptions) {
    this.logger.log(
      `Triggering notification of type ${options.type} from actor ${options.actorId} to receiver ${options.receiverId}`,
    );
    if (options.actorId === options.receiverId) return;
    const isBlocking = await this.usersRepository.isBlocked(options.receiverId, options.actorId);
    if (isBlocking) {
      this.logger.log(
        `Not creating notification of type ${options.type} from actor ${options.actorId} to receiver ${options.receiverId} because the receiver has blocked the actor`,
      );
      return;
    }

    const existing = await this.notificationsRepository.findExisting(options);
    if (existing) {
      this.logger.log(
        `Found existing notification with id ${existing.id}, updating instead of creating a new one`,
      );
      return existing;
    }

    const dedupeKey = this.generateDedupeKey(options, additional);

    let notification = null;

    notification = await this.notificationsRepository.findOpenNotification(
      options.receiverId,
      dedupeKey,
    );

    if (notification) {
      const currentPayload = (notification.payload as unknown as NotificationPayloadDto) || {
        count: 1,
        actors: [],
      };

      const previousActor = {
        id: notification.actor.id.toString(),
        username: notification.actor.username,
        displayName: notification.actor.profile?.displayName || null,
        avatarUrl: notification.actor.profile?.avatarUrl || DEFAULT_PROFILE_PICTURE,
        ifFollowing: notification.actor.followers.length > 0,
      };

      const actorsMap = new Map<
        string,
        {
          username: string;
          displayName: string | null;
          avatarUrl: string | null;
          ifFollowing: boolean;
        }
      >();

      if (currentPayload.actors) {
        currentPayload.actors.forEach((a) => actorsMap.set(a.id, a));
      }

      actorsMap.set(previousActor.id.toString(), previousActor);
      const exist = actorsMap.delete(options.actorId.toString());
      const subjectIds = new Set(currentPayload.subjectIds || []);
      if (options.tweetId) {
        subjectIds.add(options.tweetId.toString());
      }
      let inc = 1;
      if (exist) {
        inc = 0;
      }

      const payload: Prisma.JsonObject = {
        count: (currentPayload.count || 0) + inc,
        actors: Array.from(actorsMap.values()),
        subjectIds: Array.from(subjectIds),
      };

      notification = await this.notificationsRepository.updtateNotificationByIdAggregation(
        notification.id,
        options,
        payload,
      );

      if (exist) {
        this.logger.log(
          `Found existing notification with id ${notification.id}, updating instead of creating a new one`,
        );
        return notification;
      }
    } else {
      const payload: Prisma.JsonObject = {
        count: 1,
        actors: [],
        subjectIds: options.tweetId ? [options.tweetId.toString()] : [],
      };

      notification = await this.notificationsRepository.createNotification(
        options,
        payload,
        dedupeKey,
      );
    }

    const count = await this.notificationsRepository.getUnseenCount(options.receiverId);

    this.logger.log(
      `Created new notification with id ${notification.id} of type ${options.type} from actor ${options.actorId} to receiver ${options.receiverId}`,
    );

    const dto = this.notificationsRepository.mapToNotificationDto(notification);

    await this.sseEvents.publishNewNotification(options.receiverId, dto, count);

    this.logger.log(
      `Finished publishing new notification with id ${notification.id} to user ${options.receiverId}`,
    );

    await this.notificationsQueue.add(
      'sendPush',
      { notificationId: notification.id.toString(), userId: options.receiverId.toString() },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
      },
    );
    this.logger.log(
      `Enqueued push notification job for notification id ${notification.id} to user ${options.receiverId}`,
    );

    return notification;
  }

  async handleUndo(options: NotificationTriggerOptions) {
    const dedupeKey = this.generateDedupeKey(options);

    const undoingActorId = options.actorId.toString();
    const notification = await this.notificationsRepository.findOpenNotification(
      options.receiverId,
      dedupeKey,
    );
    if (!notification) return;

    const currentPayload = (notification.payload as unknown as NotificationPayloadDto) || {
      count: 1,
      actors: [],
    };

    const previousActor = {
      id: notification.actor.id.toString(),
      username: notification.actor.username,
      displayName: notification.actor.profile?.displayName || null,
      avatarUrl: notification.actor.profile?.avatarUrl || DEFAULT_PROFILE_PICTURE,
      ifFollowing: notification.actor.followers.length > 0,
    };

    const actorsMap = new Map<
      string,
      {
        username: string;
        displayName: string | null;
        avatarUrl: string | null;
        ifFollowing: boolean;
      }
    >();

    if (currentPayload.actors) {
      currentPayload.actors.forEach((a) => actorsMap.set(a.id, a));
    }

    actorsMap.set(previousActor.id.toString(), previousActor);

    const exist = actorsMap.delete(undoingActorId);
    if (!exist) {
      return;
    }

    const currentCount = actorsMap.size;

    if (currentCount <= 0) {
      await this.notificationsRepository.deleteById(notification.id);

      const count = await this.notificationsRepository.getUnseenCount(options.receiverId);

      await this.sseEvents.publishNotificationDeleted(options.receiverId, notification.id, count);
      return;
    }

    let facingActorId = notification.actor.id;

    if (facingActorId.toString() === undoingActorId) {
      const nextFace = Array.from(actorsMap.keys())[0];
      if (nextFace) {
        facingActorId = BigInt(nextFace);
        actorsMap.delete(facingActorId.toString());
      }
    } else {
      actorsMap.delete(facingActorId.toString());
    }

    const payload: Prisma.JsonObject = {
      count: currentCount,
      actors: Array.from(actorsMap.values()),
    };

    options.actorId = facingActorId;

    const updated = await this.notificationsRepository.updtateNotificationByIdAggregation(
      notification.id,
      options,
      payload,
    );

    const count = await this.notificationsRepository.getUnseenCount(options.receiverId);
    const dto = this.notificationsRepository.mapToNotificationDto(updated);
    await this.sseEvents.publishNotificationUpdate(options.receiverId, dto, count);
  }

  async markAllAsSeen(receiverId: bigint) {
    const { count } = await this.notificationsRepository.markAllAsSeen(receiverId);

    await this.sseEvents.publishNotificationSeen(receiverId);

    this.logger.log(`Finished publishing mark all notifications as seen to user ${receiverId}`);

    return count;
  }

  async markAsSeen(notificationId: bigint, receiverId: bigint) {
    const notification = await this.notificationsRepository.findById(notificationId);
    if (!notification) {
      throw new HttpException(
        {
          message: NOTIFICATIONS_ERROR_MESSAGES.NOTIFICATION_NOT_FOUND,
          code: NOTIFICATIONS_ERROR_CODES.NOTIFICATION_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }
    const { count } = await this.notificationsRepository.markAsSeen(notificationId, receiverId);

    this.logger.log(
      `Marked notification id ${notificationId} as seen for user ${receiverId}, updated rows: ${count}`,
    );

    const unSeenCount = await this.notificationsRepository.getUnseenCount(receiverId);

    await this.sseEvents.publishNotificationSeen(receiverId, notificationId, unSeenCount);

    this.logger.log(
      `Finished publishing mark notification id ${notificationId} as seen to user ${receiverId}`,
    );
    return count;
  }

  async getUnseenCount(receiverId: bigint) {
    return await this.notificationsRepository.getUnseenCount(receiverId);
  }

  async getNotifications(userId: bigint, limit: number = 20, prevCursor?: string, filter?: string) {
    if (filter && filter !== 'mentions') {
      throw new HttpException(
        {
          message: PAGINATION_ERROR_MESSAGES.INVALID_FILTER,
          code: PAGINATION_ERROR_CODES.INVALID_FILTER,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    let decoded: NotificationCursor | undefined;

    if (prevCursor) {
      try {
        decoded = decodeCompositeCursor<NotificationCursor>(prevCursor);
      } catch {
        throw new HttpException(
          {
            message: PAGINATION_ERROR_MESSAGES.INVALID_CURSOR,
            code: PAGINATION_ERROR_CODES.INVALID_CURSOR,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const notifiacations = await this.notificationsRepository.getNotifications(
      userId,
      limit + 1,
      decoded,
      filter,
    );

    const pagination = paginateComposite(notifiacations, limit, prevCursor, (item) => ({
      lastEventAt: item.latestEventAt,
      id: item.id.toString(),
    }));

    //TODO: should update when aggregation is implemented
    const items = notifiacations.map((notification) =>
      this.notificationsRepository.mapToNotificationDto(notification),
    );

    return { items, pagination };
  }
}
