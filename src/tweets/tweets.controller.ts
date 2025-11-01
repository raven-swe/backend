import { Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { TweetsService } from './tweets.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/auth/types';

@Controller('tweets')
export class TweetsController {
  // --------------------------------------
  constructor(private readonly tweetsService: TweetsService) {}

  @Post(':tweetId/like')
  @UseGuards(JwtAuthGuard)
  async likeTweet(@User() user: RequestUser, @Param('tweetId') tweetId: bigint) {
    const userId = BigInt(user.id);
    return await this.tweetsService.likeTweet(userId, tweetId);
  }

  @Delete(':tweetId/like')
  @UseGuards(JwtAuthGuard)
  async unlikeTweet(@User() user: RequestUser, @Param('tweetId') tweetId: bigint) {
    const userId = BigInt(user.id);
    return await this.tweetsService.unlikeTweet(userId, tweetId);
  }
}
