import { Module } from '@nestjs/common';
import { TweetsService } from './tweets.service';
import { TweetsController } from './tweets.controller';
import { TweetsRepository } from './tweets.repository';
import { TimelineController } from './timeline/timeline.controller';
import { UsersModule } from 'src/users/users.module';
import { ProfileTweetsController } from './profile-tweets.controller';
import { TrendingModule } from 'src/trending/trending.module';
import { ContentParsingModule } from 'src/content-parsing/content-parsing.module';
import { MediaModule } from 'src/media/media.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    UsersModule,
    TrendingModule,
    ContentParsingModule,
    MediaModule,
    BullModule.registerQueue({
      name: 'timeline-following',
    }),
  ],
  providers: [TweetsService, TweetsRepository],
  controllers: [TweetsController, TimelineController, ProfileTweetsController],
  exports: [TweetsService],
})
export class TweetsModule {}
