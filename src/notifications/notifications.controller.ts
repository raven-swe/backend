import { Controller, Get, Param, Patch } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/auth/types';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('count')
  async getUnreadCount(@User() user: RequestUser) {
    return await this.notificationsService.getUnreadCount(user.id);
  }

  @Patch('mark-all-seen')
  async markAllAsSeen(@User() user: RequestUser) {
    return await this.notificationsService.markAllAsSeen(user.id);
  }

  @Patch('mark-seen/:notificationId')
  async markAsSeen(@User() user: RequestUser, @Param('notificationId') notificationId: string) {
    return await this.notificationsService.markAsSeen(notificationId, user.id);
  }
}
