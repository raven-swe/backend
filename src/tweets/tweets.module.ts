import { Module } from '@nestjs/common';
import { TweetsService } from './tweets.service';
import { TweetsController } from './tweets.controller';
import { TweetsRepository } from './tweets.repository';
import { TimelineController } from './timeline/timeline.controller';
import { UsersModule } from 'src/users/users.module';
import { TrendingModule } from 'src/trending/trending.module';

@Module({
  providers: [TweetsService, TweetsRepository],
  controllers: [TweetsController, TimelineController],
  exports: [TweetsService],
  imports: [UsersModule, TrendingModule],
})
export class TweetsModule {}
