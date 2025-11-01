import { Module } from '@nestjs/common';
import { TweetsService } from './tweets.service';
import { TweetsController } from './tweets.controller';
import { TweetsRepository } from './tweets.repository';
import { TimelineController } from './timeline/timeline.controller';

@Module({
  providers: [TweetsService, TweetsRepository],
  controllers: [TweetsController, TimelineController],
})
export class TweetsModule {}
