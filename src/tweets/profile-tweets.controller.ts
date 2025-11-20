import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { TweetsService } from './tweets.service';
import { User } from 'src/auth/decorators';
import { JwtAuthGuard } from 'src/auth/guards';
import type { RequestUser } from 'src/common/interfaces';

@Controller('users/:username')
export class ProfileTweetsController {
  constructor(private readonly tweetsService: TweetsService) {}

  @Get('tweets')
  @UseGuards(JwtAuthGuard)
  async getUserPosts(
    @Param('username') username: string,
    @User() user: RequestUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsed = Number(limit);
    const parsedLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
    return await this.tweetsService.getUserPosts(username, BigInt(user.id), parsedLimit, cursor);
  }

  @Get('replies')
  @UseGuards(JwtAuthGuard)
  async getUserReplies(
    @Param('username') username: string,
    @User() user: RequestUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsed = Number(limit);
    const parsedLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
    return await this.tweetsService.getUserPostsAndReplies(
      username,
      BigInt(user.id),
      parsedLimit,
      cursor,
    );
  }
}
