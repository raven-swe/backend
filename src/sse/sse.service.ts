import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subject } from 'rxjs';
import { RedisService } from '../redis/redis.service';
import { Redis } from 'ioredis';
import { MAX_CONNECTIONS_PER_USER } from './constants/sse-constants';
import { REDIS_TIMELINE_KEYS } from 'src/common/constants/redis-timeline-keys.constant';

interface SseConnection {
  subject: Subject<unknown>;
  topics: Set<string>;
}

@Injectable()
export class SseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SseService.name);

  private connections = new Map<string, SseConnection[]>();

  private pubClient: Redis;
  private subClient: Redis;

  private ready: Promise<void>;
  private readyResolve!: () => void;

  constructor(private readonly redisService: RedisService) {
    this.ready = new Promise((res) => {
      this.readyResolve = res;
    });
  }

  async onModuleInit() {
    this.pubClient = this.redisService.getClient();
    this.subClient = this.pubClient.duplicate();

    this.subClient.on('error', (err) => {
      this.logger.error('Redis sub client error', err);
    });

    this.subClient.on('reconnecting', () => {
      this.logger.warn('Redis sub client reconnecting...');
    });

    await this.subClient.psubscribe('sse:user:*');

    this.subClient.on('pmessage', (_pattern, channel, message) => {
      const prefix = 'sse:user:';
      const userId = channel.startsWith(prefix) ? channel.slice(prefix.length) : channel;

      let payload: unknown = message;
      try {
        payload = JSON.parse(message);
      } catch {
        // keep raw string
      }

      this.forwardToLocalSubjects(userId, payload);
    });

    this.logger.log('SseService Redis pub/sub initialized');
    this.readyResolve();
  }

  async onModuleDestroy() {
    await this.subClient.quit();
  }

  private forwardToLocalSubjects(userId: string, event: unknown) {
    const userConnections = this.connections.get(userId);
    if (!userConnections) return;

    const rawEventName = (event as Record<string, string | number>)['event'];
    const eventName = rawEventName ? String(rawEventName) : '';

    const eventTopic = eventName.split('.')[0];

    userConnections.forEach((connection) => {
      if (connection.topics.has(eventTopic)) {
        connection.subject.next(event);
      }
    });
  }

  async subscribe(userId: string, topics: string[]): Promise<Subject<unknown> | null> {
    await this.ready;

    if (!this.connections.has(userId)) {
      this.connections.set(userId, []);
    }

    const userConnections = this.connections.get(userId)!;

    if (userConnections.length >= MAX_CONNECTIONS_PER_USER) {
      const oldestConnection = userConnections.shift()!;
      oldestConnection.subject.complete();
    }

    const newSubject = new Subject<unknown>();
    const newConnection = {
      subject: newSubject,
      topics: new Set(topics),
    };
    userConnections.push(newConnection);

    if (newConnection.topics.has('timeline')) {
      await this.pubClient.sadd(REDIS_TIMELINE_KEYS.getSSEOnlineFollowingTimelineKey(), userId);
    }

    return newSubject;
  }

  async publish(userId: string, event: unknown) {
    await this.ready;
    await this.pubClient.publish(`sse:user:${userId}`, JSON.stringify(event));
  }

  unsubscribe(userId: string, subject: Subject<unknown>) {
    const userConnections = this.connections.get(userId);
    if (!userConnections) return;

    const index = userConnections.findIndex((c) => c.subject === subject);
    if (index === -1) return;

    const connectionToRemove = userConnections[index];

    subject.complete();
    userConnections.splice(index, 1);

    if (userConnections.length === 0) {
      this.connections.delete(userId);
    }

    if (connectionToRemove.topics.has('timeline')) {
      const remainingConnections = this.connections.get(userId) || [];
      const stillHasTimeline = remainingConnections.some((c) => c.topics.has('timeline')); // maybe connected to timeline through multiple devices

      if (!stillHasTimeline) {
        this.pubClient
          .srem(REDIS_TIMELINE_KEYS.getSSEOnlineFollowingTimelineKey(), userId)
          .catch((err) => {
            this.logger.error(
              `Failed to remove user ${userId} from SSE online following timeline set`,
              err,
            );
          });
      }
    }
  }
  getConnectionCount(userId: string): number {
    return this.connections.get(userId)?.length ?? 0;
  }
}
