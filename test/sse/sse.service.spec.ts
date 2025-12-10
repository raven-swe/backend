import { Test, TestingModule } from '@nestjs/testing';
import { SseService } from 'src/sse/sse.service';
import { RedisService } from 'src/redis/redis.service';
import { Redis } from 'ioredis';
import { Subject } from 'rxjs';
import { take } from 'rxjs/operators';

describe('SseService', () => {
  let service: SseService;
  let mockPubClient: Redis;
  let mockSubClient: Redis;
  let mockRedisService: Partial<RedisService>;

  beforeEach(async () => {
    mockSubClient = {
      psubscribe: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      quit: jest.fn().mockResolvedValue(undefined),
    } as unknown as Redis;

    mockPubClient = {
      publish: jest.fn(),
      duplicate: jest.fn().mockReturnValue(mockSubClient),
    } as unknown as Redis;

    mockRedisService = {
      getClient: jest.fn().mockReturnValue(mockPubClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SseService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<SseService>(SseService);
    (mockPubClient.publish as jest.Mock).mockImplementation((channel: string, message: string) => {
      const prefix = 'sse:user:';
      const userId = channel.startsWith(prefix) ? channel.slice(prefix.length) : channel;

      let payload: unknown = message;
      try {
        payload = JSON.parse(message);
      } catch {
        // ignore JSON errors, use raw string
      }

      const sseWithPrivate = service as unknown as {
        forwardToLocalSubjects: (userId: string, event: unknown) => void;
      };

      sseWithPrivate.forwardToLocalSubjects(userId, payload);

      return 1;
    });

    await service.onModuleInit();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    if (mockSubClient?.quit) {
      await mockSubClient.quit();
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const expectSubject = (subject: Subject<unknown> | null): Subject<unknown> => {
    expect(subject).not.toBeNull();
    return subject as Subject<unknown>;
  };

  describe('subscribe', () => {
    const topicList = ['dm', 'notifications'];
    it('should create a new subject and receive event for a new user', async () => {
      const userId = 'user-123';
      const subject = expectSubject(await service.subscribe(userId, topicList));

      const validEvent = { event: 'notifications.test', data: 'hello' };

      const result = await new Promise<unknown>((resolve) => {
        const subscription = subject.pipe(take(1)).subscribe((event: unknown) => {
          subscription.unsubscribe();
          resolve(event);
        });

        void service.publish(userId, validEvent);
      });

      expect(result).toEqual(validEvent);
    });

    it('should create separate subjects for multiple subscriptions of the same user', async () => {
      const userId = 'user-456';

      const subject1 = expectSubject(await service.subscribe(userId, topicList));
      const subject2 = expectSubject(await service.subscribe(userId, topicList));

      const validEvent = { event: 'dm.test', data: 'content' };

      let receivedEvents1 = 0;
      let receivedEvents2 = 0;

      await new Promise<void>((resolve) => {
        const sub1 = subject1.pipe(take(1)).subscribe(() => {
          receivedEvents1 += 1;
        });

        const sub2 = subject2.pipe(take(1)).subscribe(() => {
          receivedEvents2 += 1;
        });

        void service.publish(userId, validEvent);

        setTimeout(() => {
          sub1.unsubscribe();
          sub2.unsubscribe();
          resolve();
        }, 50);
      });

      expect(receivedEvents1).toBe(1);
      expect(receivedEvents2).toBe(1);
    });

    it('should handle multiple users with separate subscriptions', async () => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';

      const events1: unknown[] = [];
      const events2: unknown[] = [];

      const subject1 = expectSubject(await service.subscribe(userId1, topicList));
      const subject2 = expectSubject(await service.subscribe(userId2, topicList));

      const sub1 = subject1.subscribe((event: unknown) => {
        events1.push(event);
      });

      const sub2 = subject2.subscribe((event: unknown) => {
        events2.push(event);
      });

      const eventUser1 = { event: 'notifications.1', user: 1, message: 'hello' };
      const eventUser2 = { event: 'notifications.2', user: 2, message: 'world' };

      void service.publish(userId1, eventUser1);
      void service.publish(userId2, eventUser2);

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });

      expect(events1).toEqual([eventUser1]);
      expect(events2).toEqual([eventUser2]);

      sub1.unsubscribe();
      sub2.unsubscribe();
    });

    it('should limit connections per user to 5 and complete oldest when exceeded', async () => {
      const userId = 'user-max-connections';
      const subjects: Subject<unknown>[] = [];

      for (let i = 0; i < 5; i += 1) {
        const subject = expectSubject(await service.subscribe(userId, topicList));
        subjects.push(subject);
      }

      let oldestCompleted = false;
      subjects[0].subscribe({
        complete: () => {
          oldestCompleted = true;
        },
      });

      const sixthSubject = await service.subscribe(userId, topicList);
      expect(sixthSubject).not.toBeNull();

      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      expect(oldestCompleted).toBe(true);
      expect(service.getConnectionCount(userId)).toBe(5);
    });

    it('should return connection count for a user', async () => {
      const userId = 'user-count';

      expect(service.getConnectionCount(userId)).toBe(0);

      await service.subscribe(userId, topicList);
      expect(service.getConnectionCount(userId)).toBe(1);

      await service.subscribe(userId, topicList);
      expect(service.getConnectionCount(userId)).toBe(2);
    });
  });

  describe('publish', () => {
    const topicList = ['dm', 'notifications'];
    it('should publish events to subscribed users', async () => {
      const userId = 'user-789';
      const testEvent = { event: 'dm.msg', type: 'test', data: 'hello' };

      const subject = expectSubject(await service.subscribe(userId, topicList));

      const result = await new Promise<unknown>((resolve) => {
        const subscription = subject.subscribe((event: unknown) => {
          subscription.unsubscribe();
          resolve(event);
        });

        void service.publish(userId, testEvent);
      });

      expect(result).toEqual(testEvent);
    });

    it('should not throw error when publishing to non-existent user', async () => {
      await expect(
        service.publish('non-existent-user', { test: 'event' }),
      ).resolves.toBeUndefined();
    });

    it('should handle multiple events for the same user', async () => {
      const userId = 'user-multi';
      const events: unknown[] = [];

      const subject = expectSubject(await service.subscribe(userId, topicList));

      const subscription = subject.subscribe((event: unknown) => {
        events.push(event);
      });

      const e1 = { event: 'notifications.1' };
      const e2 = { event: 'notifications.2' };
      const e3 = { event: 'notifications.3' };

      void service.publish(userId, e1);
      void service.publish(userId, e2);
      void service.publish(userId, e3);

      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      expect(events).toEqual([e1, e2, e3]);
      subscription.unsubscribe();
    });
  });

  describe('unsubscribe', () => {
    const topicList = ['dm', 'notifications'];
    it('should complete the subject and remove it from the map', async () => {
      const userId = 'user-to-unsubscribe';

      let completed = false;

      const subject = expectSubject(await service.subscribe(userId, topicList));

      const subscription = subject.subscribe({
        next: () => {},
        complete: () => {
          completed = true;
        },
      });

      service.unsubscribe(userId, subject);

      await new Promise<void>((resolve) => setTimeout(resolve, 10));

      expect(completed).toBe(true);
      subscription.unsubscribe();
    });

    it('should not throw error when unsubscribing a non-existent user', async () => {
      const subject = expectSubject(await service.subscribe('temp-user', topicList));

      expect(() => {
        service.unsubscribe('non-existent-user', subject);
      }).not.toThrow();
    });

    it('should allow re-subscribing after unsubscribe', async () => {
      const userId = 'user-resubscribe';

      const subject1 = expectSubject(await service.subscribe(userId, topicList));
      const sub1 = subject1.subscribe();
      service.unsubscribe(userId, subject1);
      sub1.unsubscribe();
      const validPayload = { event: 'dm.resub', resubscribed: true };
      const subject2 = expectSubject(await service.subscribe(userId, topicList));

      const result = await new Promise<unknown>((resolve) => {
        const subscription = subject2.subscribe((event: unknown) => {
          subscription.unsubscribe();
          resolve(event);
        });

        void service.publish(userId, validPayload);
      });

      expect(result).toEqual(validPayload);
    });

    it('should not affect other users when unsubscribing one user', async () => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';

      const events2: unknown[] = [];

      const subject1 = expectSubject(await service.subscribe(userId1, topicList));
      const subject2 = expectSubject(await service.subscribe(userId2, topicList));

      const sub1 = subject1.subscribe();
      const sub2 = subject2.subscribe((event: unknown) => {
        events2.push(event);
      });

      service.unsubscribe(userId1, subject1);
      sub1.unsubscribe();

      const validPayload = { event: 'dm.active', message: 'still active' };
      void service.publish(userId2, validPayload);

      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      expect(events2).toEqual([validPayload]);
      sub2.unsubscribe();
    });
  });
});
