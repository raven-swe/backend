import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationTriggerOptions } from './interfaces/notification-trigger.interface';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A private helper to map the application DTO (string)
   * to the database payload (bigint).
   */
  private toDbPayload(options: NotificationTriggerOptions) {
    return {
      type: options.type,
      actorId: BigInt(options.actorId),
      receiverId: BigInt(options.receiverId),
      tweetId: options.tweetId ? BigInt(options.tweetId) : undefined,
    };
  }

  async createNotification(options: NotificationTriggerOptions) {
    const data = this.toDbPayload(options);

    return await this.prisma.notification.create({ data });
  }

  async findExisting(options: NotificationTriggerOptions) {
    const where = this.toDbPayload(options);

    return await this.prisma.notification.findFirst({ where });
  }

  async findById(notificationId: string) {
    return await this.prisma.notification.findUnique({ where: { id: BigInt(notificationId) } });
  }

  async markAllAsSeen(receiverId: string) {
    const receiverBigInt = BigInt(receiverId);
    return await this.prisma.notification.updateMany({
      where: { receiverId: receiverBigInt, seen: false },
      data: { seen: true },
    });
  }

  async markAsSeen(notificationId: string, receiverId: string) {
    const notificationBigInt = BigInt(notificationId);
    const receiverBigInt = BigInt(receiverId);
    return await this.prisma.notification.updateMany({
      where: { id: notificationBigInt, receiverId: receiverBigInt, seen: false },
      data: { seen: true },
    });
  }

  async getUnseenCount(receiverId: string) {
    const receiverBigInt = BigInt(receiverId);
    return await this.prisma.notification.count({
      where: { receiverId: receiverBigInt, seen: false },
    });
  }
}
