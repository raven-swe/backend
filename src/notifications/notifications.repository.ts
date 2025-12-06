import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationTriggerOptions } from './interfaces/notification-trigger.interface';

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
}
