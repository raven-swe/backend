import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { TweetsService } from './tweets.service';
import { JwtAuthGuard } from 'src/auth/guards';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/common/interfaces';
import { ParseBigIntPipe } from 'src/common/pipes';
import { CreateTweetDto } from './dtos';

@Controller('tweets')
@UseGuards(JwtAuthGuard)
export class TweetsController {
  constructor(private readonly tweetsService: TweetsService) {}

  @Post()
  createTweet(@User() user: RequestUser, @Body() createTweetDto: CreateTweetDto) {
    const userId = BigInt(user.id);
    return this.tweetsService.createTweet(createTweetDto, userId);
  }

  @Delete(':id')
  async deleteTweet(@User() user: RequestUser, @Param('id', ParseBigIntPipe) tweetId: bigint) {
    const userId = BigInt(user.id);
    return await this.tweetsService.deleteTweet(tweetId, userId);
  }
  // --------------------------------------
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

  @Get(':id/quotes')
  @UseGuards(JwtAuthGuard)
  async getTweetQuotes(
    @Param('id', ParseBigIntPipe) tweetId: bigint,
    @User() user: RequestUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const userId = BigInt(user.id);
    return await this.tweetsService.getTweetQuotes(tweetId, userId, parsedLimit, cursor);
  }

  @Get(':id/retweets')
  @UseGuards(JwtAuthGuard)
  async getTweetRetweeters(
    @Param('id', ParseBigIntPipe) tweetId: bigint,
    @User() user: RequestUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const userId = BigInt(user.id);
    return await this.tweetsService.getTweetRetweeters(tweetId, userId, parsedLimit, cursor);
  }

  @Get(':id/likes')
  @UseGuards(JwtAuthGuard)
  async getTweetLikers(
    @Param('id', ParseBigIntPipe) tweetId: bigint,
    @User() user: RequestUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const userId = BigInt(user.id);
    return await this.tweetsService.getTweetLikers(tweetId, userId, parsedLimit, cursor);
  }

  @Get(':id/replies')
  @UseGuards(JwtAuthGuard)
  async getTweetReplies(
    @Param('id', ParseBigIntPipe) tweetId: bigint,
    @User() user: RequestUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const userId = BigInt(user.id);
    return await this.tweetsService.getTweetReplies(tweetId, userId, parsedLimit, cursor);
  }

  @Get(':id/summary')
  @UseGuards(JwtAuthGuard)
  async getTweetSummary(@Param('id', ParseBigIntPipe) tweetId: bigint) {
    return await this.tweetsService.getTweetSummary(tweetId);
  }
}
