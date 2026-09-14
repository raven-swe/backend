import { Injectable } from '@nestjs/common';
import { SseService } from './sse.service';
import { MediaUrlService } from 'src/common/media-url';

export interface SseEvent {
  event: string;
  data: unknown;
}

@Injectable()
export class EventPublisherService {
  constructor(
    private readonly sse: SseService,
    private readonly mediaUrlService: MediaUrlService,
  ) {}

  async publishToUser(userId: string, event: SseEvent) {
    await this.sse.publish(userId, this.mediaUrlService.resolve(event));
  }

  async publishToUsers(userIds: string[], event: SseEvent) {
    const resolved = this.mediaUrlService.resolve(event);
    await Promise.all(userIds.map((userId) => this.sse.publish(userId, resolved)));
  }
}
