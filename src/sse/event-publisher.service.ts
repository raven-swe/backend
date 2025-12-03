import { Injectable, Logger } from '@nestjs/common';
import { SseService } from './sse.service';

export interface SseEvent {
  event: string;
  data: unknown;
}

@Injectable()
export class EventPublisherService {
  private readonly logger = new Logger(EventPublisherService.name);

  constructor(private readonly sse: SseService) {}

  async publishToUser(userId: string, event: SseEvent) {
    this.logger.log(`Publishing ${event.event} to user ${userId}`);
    await this.sse.publish(userId, event);
  }

  async publishToUsers(userIds: string[], event: SseEvent) {
    this.logger.log(`Publishing ${event.event} to ${userIds.length} users`);
    await Promise.all(userIds.map((userId) => this.sse.publish(userId, event)));
  }
}
