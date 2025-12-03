import { Module, forwardRef } from '@nestjs/common';
import { SseService } from './sse.service';
import { SseController } from './sse.controller';
import { EventPublisherService } from './event-publisher.service';
import { SseEventsService } from './sse-events.service';
import { ConversationsModule } from 'src/conversations/conversations.module';

@Module({
  imports: [forwardRef(() => ConversationsModule)],
  controllers: [SseController],
  providers: [SseService, EventPublisherService, SseEventsService],
  exports: [SseService, EventPublisherService, SseEventsService],
})
export class SseModule {}
