import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subject } from 'rxjs';
import { RedisService } from '../redis/redis.service';
import { Redis } from 'ioredis';
import { MAX_CONNECTIONS_PER_USER } from './constants/conversation-constants';

@Injectable()
export class SseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SseService.name);

  private subjects = new Map<string, Subject<unknown>[]>();

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
    const userSubjects = this.subjects.get(userId);
    if (userSubjects) {
      userSubjects.forEach((subject) => subject.next(event));
    }
  }

  async subscribe(userId: string): Promise<Subject<unknown> | null> {
    await this.ready;

    if (!this.subjects.has(userId)) {
      this.subjects.set(userId, []);
    }

    const userSubjects = this.subjects.get(userId)!;

    if (userSubjects.length >= MAX_CONNECTIONS_PER_USER) {
      const oldestSubject = userSubjects.shift()!;
      oldestSubject.complete();
    }

    const newSubject = new Subject<unknown>();
    userSubjects.push(newSubject);

    return newSubject;
  }

  async publish(userId: string, event: unknown) {
    await this.ready;
    await this.pubClient.publish(`sse:user:${userId}`, JSON.stringify(event));
  }

  unsubscribe(userId: string, subject: Subject<unknown>) {
    const userSubjects = this.subjects.get(userId);
    if (!userSubjects) return;

    const index = userSubjects.indexOf(subject);
    if (index === -1) return;

    subject.complete();
    userSubjects.splice(index, 1);

    if (userSubjects.length === 0) {
      this.subjects.delete(userId);
    }
  }

  getConnectionCount(userId: string): number {
    return this.subjects.get(userId)?.length ?? 0;
  }
}
