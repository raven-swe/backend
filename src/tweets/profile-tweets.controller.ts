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
  async getUserFollowings(
    @Param('username') username: string,
    @User() user: RequestUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsed = Number(limit);
    const parsedLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
    const { items, pagination } = await this.tweetsService.getUserProfileTweets(
      username,
      BigInt(user.id),
      parsedLimit,
      cursor,
    );
    return { items, pagination };
  }
}
