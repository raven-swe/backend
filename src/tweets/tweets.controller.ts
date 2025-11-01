import { Controller, Post } from '@nestjs/common';
import { CreateTweetDto } from './dtos/create-tweet.dto';
import { TweetsService } from './tweets.service';

@Controller('tweets')
export class TweetsController {
  constructor(private readonly tweetsService: TweetsService) {}

  @Post()
  createTweet(createTweetDto: CreateTweetDto) {
    return this.tweetsService.createTweet(createTweetDto, 1n);
  }
  // --------------------------------------
}
