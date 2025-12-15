import { Module } from '@nestjs/common';
import { TimelineService } from './timeline.service';
import { TimelineController } from './timeline.controller';
import { BullModule } from '@nestjs/bullmq';
import { UsersModule } from 'src/users/users.module';
import { TweetsModule } from '../tweets.module';
import { TimelineConsumer } from './timeline.consumer';
import { TimelineEventsService } from './timeline.events.service';
import { SseModule } from 'src/sse/sse.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'timeline-following' }),
    UsersModule,
    TweetsModule,
    SseModule,
  ],
  providers: [TimelineService, TimelineConsumer, TimelineEventsService],
  controllers: [TimelineController],
})
export class TimelineModule {}
