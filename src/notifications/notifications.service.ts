import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';
import { NotificationTriggerOptions } from './interfaces/notification-trigger.interface';
import { NOTIFICATIONS_ERROR_CODES, NOTIFICATIONS_ERROR_MESSAGES } from './constants';
import { NotificationCursor } from 'src/common/interfaces';
import { decodeCompositeCursor, paginateComposite } from 'src/common/utils';
import { PAGINATION_ERROR_CODES, PAGINATION_ERROR_MESSAGES } from 'src/common/constants';
import { NotificationResponseDto } from './dtos/notification-response.dto';
import { TweetsRepository } from 'src/tweets/tweets.repository';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly tweetRepository: TweetsRepository,
  ) {}
  async trigger(options: NotificationTriggerOptions) {
    if (options.actorId === options.receiverId) return;

    const existing = await this.notificationsRepository.findExisting(options);
    if (existing) return existing;

    return await this.notificationsRepository.createNotification(options);
  }

  async markAllAsSeen(receiverId: bigint) {
    const { count } = await this.notificationsRepository.markAllAsSeen(receiverId);
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
    const items = notifiacations.map(
      (n): NotificationResponseDto => ({
        id: n.id.toString(),
        type: n.type,
        actorSummary: {
          totalCount: 1,
          previewActors: [
            {
              username: n.actor.username,
              displayName: n.actor.profile?.displayName,
              avatarUrl: n.actor.profile?.avatarUrl || null,
              isFollowing: n.actor.followers.length > 0,
            },
          ],
        },
        tweetSummary: {
          totalCount: n.tweet?.id ? 1 : 0,
          subjectIds: n.tweet?.id ? [n.tweet.id.toString()] : [],
          primaryTweet: n.tweet ? this.tweetRepository.mapToTweetDto(n.tweet) : null,
        },
        latestEventAt: n.latestEventAt,
        isSeen: n.seen,
      }),
    );

    return { items, pagination };
  }
}
