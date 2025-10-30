import { Injectable } from '@nestjs/common';
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
    return await this.notificationsRepository.markAllAsSeen(receiverId);
  }

  async markAsSeen(notificationId: string, receiverId: string) {
    return await this.notificationsRepository.markAsSeen(notificationId, receiverId);
  }

  async getUnseenCount(receiverId: string) {
    return await this.notificationsRepository.getUnseenCount(receiverId);
  }
}
