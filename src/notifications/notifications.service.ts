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

@Injectable()
export class NotificationsService {
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

    const notification = await this.notificationsRepository.createNotification(options);
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
        jobId: `notification:push:${notification.id}`,
      },
    );
    this.logger.log(
      `Enqueued push notification job for notification id ${notification.id} to user ${options.receiverId}`,
    );

    return notification;
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
