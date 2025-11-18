import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { TweetsService } from './tweets.service';
import { JwtAuthGuard } from 'src/auth/guards';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/common/interfaces';
import { ParseBigIntPipe } from 'src/common/pipes';

@Controller('tweets')
@UseGuards(JwtAuthGuard)
export class TweetsController {
  // --------------------------------------
  constructor(private readonly tweetsService: TweetsService) {}

  @Post(':id/like')
  async likeTweet(@User() user: RequestUser, @Param('id', ParseBigIntPipe) tweetId: bigint) {
    const userId = BigInt(user.id);
    return await this.tweetsService.likeTweet(userId, tweetId);
  }

  @Delete(':id/like')
  async unlikeTweet(@User() user: RequestUser, @Param('id', ParseBigIntPipe) tweetId: bigint) {
    const userId = BigInt(user.id);
    return await this.tweetsService.unlikeTweet(userId, tweetId);
  }

  @Post(':id/retweet')
  async retweetTweet(@User() user: RequestUser, @Param('id', ParseBigIntPipe) tweetId: bigint) {
    const userId = BigInt(user.id);
    return await this.tweetsService.retweetTweet(userId, tweetId);
  }

  @Delete(':id/retweet')
  @UseGuards(JwtAuthGuard)
  async unretweetTweet(@User() user: RequestUser, @Param('id', ParseBigIntPipe) tweetId: bigint) {
    const userId = BigInt(user.id);
    return await this.tweetsService.unretweetTweet(userId, tweetId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getTweet(@User() user: RequestUser, @Param('id', ParseBigIntPipe) tweetId: bigint) {
    const userId = BigInt(user.id);
    return await this.tweetsService.getTweet(tweetId, userId);
  }
}
