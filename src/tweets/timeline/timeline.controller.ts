import { Controller, Get, HttpCode, Query, UseGuards } from '@nestjs/common';
import { User } from 'src/auth/decorators';
import { PaginationQueryDto } from 'src/common/dtos/pagination-query.dto';
import { TweetsService } from '../tweets.service';
import type { RequestUser } from 'src/auth/types';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('timeline')
export class TimelineController {
  constructor(private readonly tweetsService: TweetsService) {}

  @Get('following')
  @HttpCode(200)
  async getTimeline(@Query() pagination: PaginationQueryDto, @User() user: RequestUser) {
    const userId = BigInt(user.id);
    const { limit, cursor } = pagination;
    const timelineTweets = await this.tweetsService.getTimeline(userId, cursor, limit);
    return {
      message: 'Timeline retrieved successfully',
      ...timelineTweets,
    };
  }
}
