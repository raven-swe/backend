import { Test, TestingModule } from '@nestjs/testing';
import { SseService } from 'src/conversations/sse.service';
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
    it('should create a new subject and receive event for a new user', async () => {
      const userId = 'user-123';
      const subject = expectSubject(await service.subscribe(userId));

      const result = await new Promise<unknown>((resolve) => {
        const subscription = subject.pipe(take(1)).subscribe((event: unknown) => {
          subscription.unsubscribe();
          resolve(event);
        });

        void service.publish(userId, { test: 'event' });
      });

      expect(result).toEqual({ test: 'event' });
    });

    it('should create separate subjects for multiple subscriptions of the same user', async () => {
      const userId = 'user-456';

      const subject1 = expectSubject(await service.subscribe(userId));
      const subject2 = expectSubject(await service.subscribe(userId));

      let receivedEvents1 = 0;
      let receivedEvents2 = 0;

      await new Promise<void>((resolve) => {
        const sub1 = subject1.pipe(take(1)).subscribe(() => {
          receivedEvents1 += 1;
        });

        const sub2 = subject2.pipe(take(1)).subscribe(() => {
          receivedEvents2 += 1;
        });

        void service.publish(userId, { test: 'shared-event' });

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

      const subject1 = expectSubject(await service.subscribe(userId1));
      const subject2 = expectSubject(await service.subscribe(userId2));

      const sub1 = subject1.subscribe((event: unknown) => {
        events1.push(event);
      });

      const sub2 = subject2.subscribe((event: unknown) => {
        events2.push(event);
      });

      void service.publish(userId1, { user: 1, message: 'hello' });
      void service.publish(userId2, { user: 2, message: 'world' });

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });

      expect(events1).toEqual([{ user: 1, message: 'hello' }]);
      expect(events2).toEqual([{ user: 2, message: 'world' }]);

      sub1.unsubscribe();
      sub2.unsubscribe();
    });

    it('should limit connections per user to 5 and complete oldest when exceeded', async () => {
      const userId = 'user-max-connections';
      const subjects: Subject<unknown>[] = [];

      for (let i = 0; i < 5; i += 1) {
        const subject = expectSubject(await service.subscribe(userId));
        subjects.push(subject);
      }

      let oldestCompleted = false;
      subjects[0].subscribe({
        complete: () => {
          oldestCompleted = true;
        },
      });

      const sixthSubject = await service.subscribe(userId);
      expect(sixthSubject).not.toBeNull();

      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      expect(oldestCompleted).toBe(true);
      expect(service.getConnectionCount(userId)).toBe(5);
    });

    it('should return connection count for a user', async () => {
      const userId = 'user-count';

      expect(service.getConnectionCount(userId)).toBe(0);

      await service.subscribe(userId);
      expect(service.getConnectionCount(userId)).toBe(1);

      await service.subscribe(userId);
      expect(service.getConnectionCount(userId)).toBe(2);
    });
  });

  describe('publish', () => {
    it('should publish events to subscribed users', async () => {
      const userId = 'user-789';
      const testEvent = { type: 'test', data: 'hello' };

      const subject = expectSubject(await service.subscribe(userId));

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

      const subject = expectSubject(await service.subscribe(userId));

      const subscription = subject.subscribe((event: unknown) => {
        events.push(event);
      });

      void service.publish(userId, { event: 1 });
      void service.publish(userId, { event: 2 });
      void service.publish(userId, { event: 3 });

      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      expect(events).toEqual([{ event: 1 }, { event: 2 }, { event: 3 }]);
      subscription.unsubscribe();
    });
  });

  describe('unsubscribe', () => {
    it('should complete the subject and remove it from the map', async () => {
      const userId = 'user-to-unsubscribe';

      let completed = false;

      const subject = expectSubject(await service.subscribe(userId));

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
      const subject = expectSubject(await service.subscribe('temp-user'));

      expect(() => {
        service.unsubscribe('non-existent-user', subject);
      }).not.toThrow();
    });

    it('should allow re-subscribing after unsubscribe', async () => {
      const userId = 'user-resubscribe';

      const subject1 = expectSubject(await service.subscribe(userId));
      const sub1 = subject1.subscribe();
      service.unsubscribe(userId, subject1);
      sub1.unsubscribe();

      const subject2 = expectSubject(await service.subscribe(userId));

      const result = await new Promise<unknown>((resolve) => {
        const subscription = subject2.subscribe((event: unknown) => {
          subscription.unsubscribe();
          resolve(event);
        });

        void service.publish(userId, { resubscribed: true });
      });

      expect(result).toEqual({ resubscribed: true });
    });

    it('should not affect other users when unsubscribing one user', async () => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';

      const events2: unknown[] = [];

      const subject1 = expectSubject(await service.subscribe(userId1));
      const subject2 = expectSubject(await service.subscribe(userId2));

      const sub1 = subject1.subscribe();
      const sub2 = subject2.subscribe((event: unknown) => {
        events2.push(event);
      });

      service.unsubscribe(userId1, subject1);
      sub1.unsubscribe();

      void service.publish(userId2, { message: 'still active' });

      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      expect(events2).toEqual([{ message: 'still active' }]);
      sub2.unsubscribe();
    });
  });
});
