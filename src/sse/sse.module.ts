import { Module } from '@nestjs/common';
import { SseService } from './sse.service';
import { SseController } from './sse.controller';
import { EventPublisherService } from './event-publisher.service';

@Module({
  controllers: [SseController],
  providers: [SseService, EventPublisherService],
  exports: [SseService, EventPublisherService],
})
export class SseModule {}
