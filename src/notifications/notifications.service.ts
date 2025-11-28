import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';
import { NotificationTriggerOptions } from './interfaces/notification-trigger.interface';
import { NOTIFICATIONS_ERROR_CODES, NOTIFICATIONS_ERROR_MESSAGES } from './constants';

@Injectable()
export class NotificationsService {
  constructor(private readonly notificationsRepository: NotificationsRepository) {}
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
}
