import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { CreateTweetDto } from './dtos/create-tweet.dto';
import { TweetsService } from './tweets.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/auth/types';

@Controller('tweets')
@UseGuards(JwtAuthGuard)
export class TweetsController {
  constructor(private readonly tweetsService: TweetsService) {}

  @Post()
  @HttpCode(201)
  createTweet(@User() user: RequestUser, @Body() createTweetDto: CreateTweetDto) {
    const userId = BigInt(user.id);
    return this.tweetsService.createTweet(createTweetDto, userId);
  }
  // --------------------------------------
}
