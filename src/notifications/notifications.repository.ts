import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationTriggerOptions } from './interfaces/notification-trigger.interface';
import { NotificationCursor } from 'src/common/interfaces';
import { tweetInclude } from 'src/tweets/tweets.repository';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(data: NotificationTriggerOptions) {
    return await this.prisma.notification.create({ data });
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
      select: {
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
          },
        },
        tweet: {
          include: tweetInclude(userId),
        },
      },
    });
  }
}
