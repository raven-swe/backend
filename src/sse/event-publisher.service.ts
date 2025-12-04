import { Injectable } from '@nestjs/common';
import { SseService } from './sse.service';

export interface SseEvent {
  event: string;
  data: unknown;
}

@Injectable()
export class EventPublisherService {
  constructor(private readonly sse: SseService) {}

  async publishToUser(userId: string, event: SseEvent) {
    await this.sse.publish(userId, event);
  }

  async publishToUsers(userIds: string[], event: SseEvent) {
    await Promise.all(userIds.map((userId) => this.sse.publish(userId, event)));
  }
}
