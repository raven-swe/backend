import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationTriggerOptions } from './interfaces/notification-trigger.interface';
import { NotificationCursor } from 'src/common/interfaces';
import { tweetInclude, TweetsRepository } from 'src/tweets/tweets.repository';
import { Prisma } from '@prisma/client';
import { NotificationResponseDto } from './dtos/notification-response.dto';
import { DEFAULT_PROFILE_PICTURE } from 'src/users/constants';
import { NotificationPayloadDto } from './dtos/notification-payload.dto';

export const notificationSelect = (userId: bigint) =>
  ({
    id: true,
    type: true,
    createdAt: true,
    latestEventAt: true,
    payload: true,
    seen: true,
    actor: {
      select: {
        id: true,
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
    const currentPayload = (n.payload as unknown as NotificationPayloadDto) || {
      count: 1,
      actors: [],
    };
    const actors = [
      {
        username: n.actor.username,
        displayName: n.actor.profile?.displayName,
        avatarUrl: n.actor.profile?.avatarUrl ?? DEFAULT_PROFILE_PICTURE,
        isFollowing: n.actor.followers.length > 0,
      },
    ].concat(
      currentPayload.actors.map((a) => ({
        username: a.username,
        displayName: a.displayName ?? DEFAULT_PROFILE_PICTURE,
        avatarUrl: a.avatarUrl,
        isFollowing: a.ifFollowing,
      })),
    );

    return {
      id: n.id.toString(),
      type: n.type,
      actorSummary: {
        totalCount: 1,
        previewActors: actors,
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

  async deleteById(notificationId: bigint) {
    return await this.prisma.notification.deleteMany({ where: { id: notificationId } });
  }

  async deleteExisting(options: NotificationTriggerOptions) {
    return await this.prisma.notification.deleteMany({ where: options });
  }

  async findOpenNotification(receiverId: bigint, dedupeKey: string) {
    return await this.prisma.notification.findUnique({
      where: { dedupeKey },
      select: notificationSelect(receiverId),
    });
  }

  async updtateNotificationByIdAggregation(
    id: bigint,
    options: NotificationTriggerOptions,
    payload: Prisma.JsonObject,
  ) {
    return await this.prisma.notification.update({
      where: { id },
      data: {
        actorId: options.actorId,
        latestEventAt: new Date(),
        isAggregated: true,
        seen: false,
        payload,
      },
      select: notificationSelect(options.receiverId),
    });
  }

  async findByIdForPush(notificationId: bigint, receiverId: bigint) {
    return await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: {
        id: true,
        type: true,
        createdAt: true,
        latestEventAt: true,
        seen: true,
        isAggregated: true,
        payload: true,
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
            followers: { where: { followerId: receiverId } },
          },
        },
      },
    });
  }

  async createNotification(
    data: NotificationTriggerOptions,
    payload: Prisma.JsonObject,
    dedupeKey: string | null,
  ): Promise<NotificationWithDetails> {
    return await this.prisma.notification.create({
      data: { ...data, payload, dedupeKey },
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
