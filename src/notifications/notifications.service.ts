import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';
import { NotificationTriggerOptions } from './interfaces/notification-trigger.interface';

@Injectable()
export class NotificationsService {
  constructor(private readonly notificationsRepository: NotificationsRepository) {}
  async trigger(options: NotificationTriggerOptions) {
    if (options.actorId === options.receiverId) return;

    const existing = await this.notificationsRepository.findExisting(options);
    if (existing) return existing;

    return await this.notificationsRepository.createNotification(options);
  }

  async markAllAsSeen(receiverId: string) {
    const { count } = await this.notificationsRepository.markAllAsSeen(receiverId);
    return { count };
  }

  async markAsSeen(notificationId: string, receiverId: string) {
    const notification = await this.notificationsRepository.findById(notificationId);
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    const { count } = await this.notificationsRepository.markAsSeen(notificationId, receiverId);
    return count;
  }

  async getUnseenCount(receiverId: string) {
    return await this.notificationsRepository.getUnseenCount(receiverId);
  }
}
