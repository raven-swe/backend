import { Module } from '@nestjs/common';
import { TimelineService } from './timeline.service';
import { TimelineController } from './timeline.controller';
import { BullModule } from '@nestjs/bullmq';
import { UsersModule } from 'src/users/users.module';
import { TweetsModule } from '../tweets.module';
import { TimelineConsumer } from './timeline.consumer';

@Module({
  imports: [BullModule.registerQueue({ name: 'timeline-following' }), UsersModule, TweetsModule],
  providers: [TimelineService, TimelineConsumer],
  controllers: [TimelineController],
})
export class TimelineModule {}
