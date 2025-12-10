import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationTriggerOptions } from './interfaces/notification-trigger.interface';
import { NotificationCursor } from 'src/common/interfaces';
import { tweetInclude, TweetsRepository } from 'src/tweets/tweets.repository';
import { Prisma } from '@prisma/client';
import { NotificationResponseDto } from './dtos/notification-response.dto';
import { DEFAULT_PROFILE_PICTURE } from 'src/users/constants';

export const notificationSelect = (userId: bigint) =>
  ({
    id: true,
    type: true,
    createdAt: true,
    latestEventAt: true,
    seen: true,
    actor: {
      select: {
        username: true,
        profile: {
          select: {
            avatarUrl: true,
            displayName: true,
          },
        },
        followers: {
          where: { followerId: userId },
        },
      },
    },
    tweet: {
      include: { ...tweetInclude(userId), quotedTweet: { include: tweetInclude(userId) } },
    },
  }) satisfies Prisma.NotificationSelect;

export type NotificationWithDetails = Prisma.NotificationGetPayload<{
  select: ReturnType<typeof notificationSelect>;
}>;

@Injectable()
export class NotificationsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tweetRepository: TweetsRepository,
  ) {}

  mapToNotificationDto(n: NotificationWithDetails): NotificationResponseDto {
    return {
      id: n.id.toString(),
      type: n.type,
      actorSummary: {
        totalCount: 1,
        previewActors: [
          {
            username: n.actor.username,
            displayName: n.actor.profile?.displayName,
            avatarUrl: n.actor.profile?.avatarUrl || DEFAULT_PROFILE_PICTURE,
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
    };
  }

  async deleteByOptions(options: NotificationTriggerOptions) {
    return await this.prisma.notification.deleteMany({ where: options });
  }

  async findByIdForPush(notificationId: bigint) {
    return await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: {
        id: true,
        type: true,
        createdAt: true,
        latestEventAt: true,
        seen: true,
        isAggregated: true,
        tweet: {
          select: { id: true, content: true },
        },
        actor: {
          select: {
            username: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
  }

  async createNotification(data: NotificationTriggerOptions): Promise<NotificationWithDetails> {
    return await this.prisma.notification.create({
      data,
      select: notificationSelect(data.receiverId),
    });
  }

  async findExisting(where: NotificationTriggerOptions) {
    return await this.prisma.notification.findFirst({ where });
  }

  async findById(notificationId: bigint) {
    return await this.prisma.notification.findUnique({ where: { id: notificationId } });
  }

  async markAllAsSeen(receiverId: bigint) {
    return await this.prisma.notification.updateMany({
      where: { receiverId: receiverId, seen: false },
      data: { seen: true },
    });
  }

  async markAsSeen(notificationId: bigint, receiverId: bigint) {
    return await this.prisma.notification.updateMany({
      where: { id: notificationId, receiverId: receiverId, seen: false },
      data: { seen: true },
    });
  }

  async getUnseenCount(receiverId: bigint) {
    return await this.prisma.notification.count({
      where: { receiverId: receiverId, seen: false },
    });
  }

  async getNotifications(
    userId: bigint,
    limit: number,
    prevCursor?: NotificationCursor,
    filter?: string,
  ) {
    return await this.prisma.notification.findMany({
      where: {
        receiverId: userId,
        ...(filter && filter === 'mentions' ? { type: 'MENTION' } : {}),
        ...(prevCursor
          ? {
              OR: [
                {
                  latestEventAt: { lte: prevCursor.latestEventAt },
                },
                {
                  latestEventAt: prevCursor.latestEventAt,
                  id: { lte: BigInt(prevCursor.id) },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ latestEventAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: notificationSelect(userId),
    });
  }
}
