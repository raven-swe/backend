import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { User } from 'src/auth/decorators';
import { JwtAuthGuard } from 'src/auth/guards';
import type { RequestUser } from 'src/common/interfaces';
import { ParseBigIntPipe } from 'src/common/pipes';
import { PAGINATION } from 'src/common/constants';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('count')
  async getUnseenCount(@User() user: RequestUser) {
    const count = await this.notificationsService.getUnseenCount(BigInt(user.id));
    return { unseenCount: count };
  }

  @Patch('seen')
  async markAllAsSeen(@User() user: RequestUser) {
    const count = await this.notificationsService.markAllAsSeen(BigInt(user.id));

    return { updatedCount: count };
  }

  @Patch(':notificationId/seen')
  async markAsSeen(
    @User() user: RequestUser,
    @Param('notificationId', ParseBigIntPipe) notificationId: bigint,
  ) {
    const count = await this.notificationsService.markAsSeen(notificationId, BigInt(user.id));
    return { updatedCount: count };
  }

  @Get()
  async getNotifications(
    @User() user: RequestUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('filter') filter?: string,
  ) {
    const userId = BigInt(user.id);
    const parsed = Number(limit);
    const parsedLimit =
      Number.isFinite(parsed) && parsed > 0
        ? Math.min(parsed, PAGINATION.MAX_LIMIT) // Whichever is smaller: the user's request or 100
        : PAGINATION.DEFAULT_LIMIT;

    const { items, pagination } = await this.notificationsService.getNotifications(
      userId,
      parsedLimit,
      cursor,
      filter,
    );

    return { items, pagination };
  }
}
