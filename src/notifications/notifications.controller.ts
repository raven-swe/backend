import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { User } from 'src/auth/decorators';
import { JwtAuthGuard } from 'src/auth/guards';
import type { RequestUser } from 'src/common/interfaces';
import { ParseBigIntPipe } from 'src/common/pipes';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('count')
  @UseGuards(JwtAuthGuard)
  async getUnseenCount(@User() user: RequestUser) {
    const count = await this.notificationsService.getUnseenCount(BigInt(user.id));
    return { unseenCount: count };
  }

  @Patch('mark-all-seen')
  @UseGuards(JwtAuthGuard)
  async markAllAsSeen(@User() user: RequestUser) {
    const count = await this.notificationsService.markAllAsSeen(BigInt(user.id));

    return { updatedCount: count };
  }

  @Patch(':notificationId/mark-seen')
  @UseGuards(JwtAuthGuard)
  async markAsSeen(
    @User() user: RequestUser,
    @Param('notificationId', ParseBigIntPipe) notificationId: bigint,
  ) {
    const count = await this.notificationsService.markAsSeen(notificationId, BigInt(user.id));
    return { updatedCount: count };
  }
}
