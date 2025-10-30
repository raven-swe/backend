import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/auth/types';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('count')
  @UseGuards(JwtAuthGuard)
  async getUnseenCount(@User() user: RequestUser) {
    const count = await this.notificationsService.getUnseenCount(user.id);
    return { unseenCount: count };
  }

  @Patch('mark-all-seen')
  @UseGuards(JwtAuthGuard)
  async markAllAsSeen(@User() user: RequestUser) {
    const count = await this.notificationsService.markAllAsSeen(user.id);

    return { updatedCount: count };
  }

  @Patch(':notificationId/mark-seen')
  @UseGuards(JwtAuthGuard)
  async markAsSeen(@User() user: RequestUser, @Param('notificationId') notificationId: string) {
    const count = await this.notificationsService.markAsSeen(notificationId, user.id);
    return { updatedCount: count };
  }
}
