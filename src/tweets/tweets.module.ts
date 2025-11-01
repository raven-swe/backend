import { Module } from '@nestjs/common';
import { TweetsService } from './tweets.service';
import { TweetsController } from './tweets.controller';
import { TweetsRepository } from './tweets.repository';

@Module({
  providers: [TweetsService, TweetsRepository],
  controllers: [TweetsController],
})
export class TweetsModule {}
