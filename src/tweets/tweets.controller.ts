import { Controller, Get, HttpCode, Query, UseGuards } from '@nestjs/common';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/auth/types';
import { TweetsService } from './tweets.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PaginationQueryDto } from 'src/common/pagination-query.dto';

@Controller('tweets')
@UseGuards(JwtAuthGuard)
export class TweetsController {
  constructor(private readonly tweetsService: TweetsService) {}

  @Get('timeline')
  @HttpCode(200)
  async getTimeline(@Query() pagination: PaginationQueryDto, @User() user: RequestUser) {
    const userId = BigInt(user.id);
    const { limit, cursor } = pagination;
    console.log(
      `Received request for timeline - User ID: ${userId}, Limit: ${limit}, Cursor: ${cursor}`,
    );
    const timelineTweets = await this.tweetsService.getTimeline(userId, cursor, limit);
    console.log('Timeline tweets count:', timelineTweets.items.length);
    return {
      message: 'Full timeline retrieved successfully',
      data: timelineTweets,
    };
  }
  // --------------------------------------
}
