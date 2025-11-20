import { Module } from '@nestjs/common';
import { TweetsService } from './tweets.service';
import { TweetsController } from './tweets.controller';
import { TweetsRepository } from './tweets.repository';
import { TimelineController } from './timeline/timeline.controller';
import { UsersModule } from 'src/users/users.module';
import { ProfileTweetsController } from './profile-tweets.controller';

@Module({
  providers: [TweetsService, TweetsRepository],
  controllers: [TweetsController, TimelineController, ProfileTweetsController],
  exports: [TweetsService],
  imports: [UsersModule],
})
export class TweetsModule {}
