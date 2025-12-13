import { Controller, Get, HttpCode, Query, UseGuards } from '@nestjs/common';
import { User } from 'src/auth/decorators';
import { PaginationQueryDto } from 'src/common/dtos';
import { JwtAuthGuard } from 'src/auth/guards';
import type { RequestUser } from 'src/common/interfaces';
import { TimelineService } from './timeline.service';

@UseGuards(JwtAuthGuard)
@Controller('timeline')
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Get('following')
  @HttpCode(200)
  async getTimeline(@Query() pagination: PaginationQueryDto, @User() user: RequestUser) {
    const userId = BigInt(user.id);
    const { limit, cursor } = pagination;
    const timelineTweets = await this.timelineService.getTimeline(userId, cursor, limit);
    return {
      message: 'Timeline retrieved successfully',
      ...timelineTweets,
    };
  }

  @Get('for-you')
  @HttpCode(200)
  async getForYouTimeline(@Query() pagination: PaginationQueryDto, @User() user: RequestUser) {
    const userId = BigInt(user.id);
    const { limit, cursor } = pagination;
    const timelineTweets = await this.timelineService.getForYouFeed(userId, cursor, limit);
    return {
      message: 'For You Timeline retrieved successfully',
      ...timelineTweets,
    };
  }
}
