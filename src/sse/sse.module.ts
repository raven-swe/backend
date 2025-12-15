import { Module, forwardRef } from '@nestjs/common';
import { SseService } from './sse.service';
import { SseController } from './sse.controller';
import { EventPublisherService } from './event-publisher.service';
import { SseEventsService } from './sse-events.service';
import { ConversationsModule } from 'src/conversations/conversations.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { TweetsModule } from 'src/tweets/tweets.module';

@Module({
  imports: [
    forwardRef(() => ConversationsModule),
    forwardRef(() => NotificationsModule),
    forwardRef(() => TweetsModule),
  ],
  controllers: [SseController],
  providers: [SseService, EventPublisherService, SseEventsService],
  exports: [SseService, EventPublisherService, SseEventsService],
})
export class SseModule {}
