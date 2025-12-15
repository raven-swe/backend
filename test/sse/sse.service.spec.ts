import { Test, TestingModule } from '@nestjs/testing';
import { SseService } from 'src/sse/sse.service';
import { RedisService } from 'src/redis/redis.service';
import { Redis } from 'ioredis';
import { Subject } from 'rxjs';
import { take } from 'rxjs/operators';
import { Logger } from '@nestjs/common';

describe('SseService', () => {
  let service: SseService;
  let mockPubClient: Redis;
  let mockSubClient: Redis;
  let mockRedisService: Partial<RedisService>;

  beforeEach(async () => {
    // Suppress logger output
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();

    mockSubClient = {
      psubscribe: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      quit: jest.fn().mockResolvedValue(undefined),
    } as unknown as Redis;

    mockPubClient = {
      publish: jest.fn(),
      duplicate: jest.fn().mockReturnValue(mockSubClient),
      sadd: jest.fn().mockResolvedValue(1),
      srem: jest.fn().mockResolvedValue(1),
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

  describe('topic filtering', () => {
    it('should only forward events to connections subscribed to matching topics', async () => {
      const userId = 'user-topic-filter';

      const dmEvents: unknown[] = [];
      const notificationEvents: unknown[] = [];

      const dmSubject = expectSubject(await service.subscribe(userId, ['dm']));
      const notificationSubject = expectSubject(await service.subscribe(userId, ['notifications']));

      const dmSub = dmSubject.subscribe((event: unknown) => {
        dmEvents.push(event);
      });

      const notificationSub = notificationSubject.subscribe((event: unknown) => {
        notificationEvents.push(event);
      });

      const dmEvent = { event: 'dm.new_message', data: 'hello' };
      const notificationEvent = { event: 'notifications.mention', data: 'you were mentioned' };

      void service.publish(userId, dmEvent);
      void service.publish(userId, notificationEvent);

      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      expect(dmEvents).toEqual([dmEvent]);
      expect(notificationEvents).toEqual([notificationEvent]);

      dmSub.unsubscribe();
      notificationSub.unsubscribe();
    });

    it('should forward events to connections with multiple topic subscriptions', async () => {
      const userId = 'user-multi-topics';

      const events: unknown[] = [];
      const subject = expectSubject(await service.subscribe(userId, ['dm', 'notifications']));

      const sub = subject.subscribe((event: unknown) => {
        events.push(event);
      });

      const dmEvent = { event: 'dm.new_message', data: 'hello' };
      const notificationEvent = { event: 'notifications.like', data: 'someone liked your post' };

      void service.publish(userId, dmEvent);
      void service.publish(userId, notificationEvent);

      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      expect(events).toEqual([dmEvent, notificationEvent]);
      sub.unsubscribe();
    });

    it('should handle events with dots in topic name correctly', async () => {
      const userId = 'user-dot-topic';

      const events: unknown[] = [];
      const subject = expectSubject(await service.subscribe(userId, ['notifications']));

      const sub = subject.subscribe((event: unknown) => {
        events.push(event);
      });

      const event1 = { event: 'notifications.follow.new', data: 'new follower' };
      const event2 = { event: 'notifications.like.post', data: 'post liked' };

      void service.publish(userId, event1);
      void service.publish(userId, event2);

      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      expect(events).toEqual([event1, event2]);
      sub.unsubscribe();
    });

    it('should not forward events if topic does not match', async () => {
      const userId = 'user-no-match';

      const events: unknown[] = [];
      const subject = expectSubject(await service.subscribe(userId, ['dm']));

      const sub = subject.subscribe((event: unknown) => {
        events.push(event);
      });

      const notificationEvent = { event: 'notifications.mention', data: 'you were mentioned' };

      void service.publish(userId, notificationEvent);

      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      expect(events).toEqual([]);
      sub.unsubscribe();
    });

    it('should handle events with missing event property', async () => {
      const userId = 'user-no-event-prop';

      const events: unknown[] = [];
      const subject = expectSubject(await service.subscribe(userId, ['dm']));

      const sub = subject.subscribe((event: unknown) => {
        events.push(event);
      });

      const eventWithoutProp = { data: 'no event property' };

      void service.publish(userId, eventWithoutProp);

      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      expect(events).toEqual([]);
      sub.unsubscribe();
    });

    it('should handle events with numeric event property', async () => {
      const userId = 'user-numeric-event';

      const events: unknown[] = [];
      const subject = expectSubject(await service.subscribe(userId, ['123']));

      const sub = subject.subscribe((event: unknown) => {
        events.push(event);
      });

      const numericEvent = { event: 123, data: 'numeric topic' };

      void service.publish(userId, numericEvent);

      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      expect(events).toEqual([numericEvent]);
      sub.unsubscribe();
    });
  });

  describe('timeline topic', () => {
    it('should add user to Redis set when subscribing to timeline topic', async () => {
      const userId = 'user-timeline';

      await service.subscribe(userId, ['timeline']);

      expect(mockPubClient.sadd).toHaveBeenCalledWith('sse:online:following_timeline', userId);
    });

    it('should not add user to Redis set when not subscribing to timeline topic', async () => {
      const userId = 'user-no-timeline';

      await service.subscribe(userId, ['dm', 'notifications']);

      expect(mockPubClient.sadd).not.toHaveBeenCalled();
    });

    it('should remove user from Redis set when unsubscribing from timeline and no other timeline connections exist', async () => {
      const userId = 'user-timeline-unsub';

      const subject = expectSubject(await service.subscribe(userId, ['timeline']));

      jest.clearAllMocks();

      service.unsubscribe(userId, subject);

      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      expect(mockPubClient.srem).toHaveBeenCalledWith('sse:online:following_timeline', userId);
    });

    it('should not remove user from Redis set when unsubscribing but other timeline connections exist', async () => {
      const userId = 'user-multiple-timeline';

      const subject1 = expectSubject(await service.subscribe(userId, ['timeline']));
      const subject2 = expectSubject(await service.subscribe(userId, ['timeline']));

      jest.clearAllMocks();

      service.unsubscribe(userId, subject1);

      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      expect(mockPubClient.srem).not.toHaveBeenCalled();

      service.unsubscribe(userId, subject2);
    });

    it('should handle Redis srem error gracefully', async () => {
      const userId = 'user-srem-error';

      (mockPubClient.srem as jest.Mock).mockRejectedValueOnce(new Error('Redis error'));

      const subject = expectSubject(await service.subscribe(userId, ['timeline']));

      expect(() => {
        service.unsubscribe(userId, subject);
      }).not.toThrow();

      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to remove user'),
        expect.any(Error),
      );
    });
  });

  describe('Redis lifecycle', () => {
    it('should initialize Redis pub/sub on module init', async () => {
      expect(mockPubClient.duplicate).toHaveBeenCalled();
      expect(mockSubClient.psubscribe).toHaveBeenCalledWith('sse:user:*');
      expect(Logger.prototype.log).toHaveBeenCalledWith('SseService Redis pub/sub initialized');
    });

    it('should register Redis error handler', async () => {
      const errorHandler = (mockSubClient.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'error',
      )?.[1];

      expect(errorHandler).toBeDefined();

      const testError = new Error('Test Redis error');
      errorHandler(testError);

      expect(Logger.prototype.error).toHaveBeenCalledWith('Redis sub client error', testError);
    });

    it('should register Redis reconnecting handler', async () => {
      const reconnectHandler = (mockSubClient.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'reconnecting',
      )?.[1];

      expect(reconnectHandler).toBeDefined();

      reconnectHandler();

      expect(Logger.prototype.warn).toHaveBeenCalledWith('Redis sub client reconnecting...');
    });

    it('should quit sub client on module destroy', async () => {
      await service.onModuleDestroy();

      expect(mockSubClient.quit).toHaveBeenCalled();
    });
  });

  describe('message handling', () => {
    it('should handle raw string messages that are not JSON', async () => {
      const userId = 'user-raw-string';
      const events: unknown[] = [];

      const subject = expectSubject(await service.subscribe(userId, ['dm']));
      const sub = subject.subscribe((event: unknown) => {
        events.push(event);
      });

      // Simulate receiving a raw string message (will be kept as string, but won't match topic filter)
      const pmessageHandler = (mockSubClient.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'pmessage',
      )?.[1];

      expect(pmessageHandler).toBeDefined();

      // Raw string without event property won't match topic filter
      pmessageHandler('sse:user:*', `sse:user:${userId}`, 'raw string message');

      await new Promise<void>((resolve) => setTimeout(resolve, 10));

      // Raw string messages without proper event structure won't be forwarded
      expect(events).toEqual([]);
      sub.unsubscribe();
    });

    it('should parse JSON messages correctly', async () => {
      const userId = 'user-json-msg';
      const events: unknown[] = [];

      const subject = expectSubject(await service.subscribe(userId, ['notifications']));
      const sub = subject.subscribe((event: unknown) => {
        events.push(event);
      });

      const pmessageHandler = (mockSubClient.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'pmessage',
      )?.[1];

      const jsonMessage = { event: 'notifications.test', data: 'parsed' };
      pmessageHandler('sse:user:*', `sse:user:${userId}`, JSON.stringify(jsonMessage));

      await new Promise<void>((resolve) => setTimeout(resolve, 10));

      expect(events).toEqual([jsonMessage]);
      sub.unsubscribe();
    });

    it('should extract userId from channel correctly', async () => {
      const userId = 'user-channel-extract';
      const events: unknown[] = [];

      const subject = expectSubject(await service.subscribe(userId, ['dm']));
      const sub = subject.subscribe((event: unknown) => {
        events.push(event);
      });

      const pmessageHandler = (mockSubClient.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'pmessage',
      )?.[1];

      const event = { event: 'dm.message', data: 'test' };
      pmessageHandler('sse:user:*', `sse:user:${userId}`, JSON.stringify(event));

      await new Promise<void>((resolve) => setTimeout(resolve, 10));

      expect(events).toEqual([event]);
      sub.unsubscribe();
    });
  });

  describe('edge cases', () => {
    it('should return 0 for connection count of non-existent user', () => {
      expect(service.getConnectionCount('non-existent-user')).toBe(0);
    });

    it('should handle unsubscribing a subject that does not exist in connections', async () => {
      const userId = 'user-exists';
      const otherSubject = new Subject<unknown>();

      await service.subscribe(userId, ['dm']);

      expect(() => {
        service.unsubscribe(userId, otherSubject);
      }).not.toThrow();
    });

    it('should delete user from connections map when last connection is removed', async () => {
      const userId = 'user-delete-from-map';

      const subject = expectSubject(await service.subscribe(userId, ['dm']));

      expect(service.getConnectionCount(userId)).toBe(1);

      service.unsubscribe(userId, subject);

      expect(service.getConnectionCount(userId)).toBe(0);
    });

    it('should handle rapid subscribe/unsubscribe cycles', async () => {
      const userId = 'user-rapid-cycle';

      for (let i = 0; i < 10; i += 1) {
        const subject = expectSubject(await service.subscribe(userId, ['dm']));
        service.unsubscribe(userId, subject);
      }

      expect(service.getConnectionCount(userId)).toBe(0);
    });

    it('should maintain separate topic sets for each connection', async () => {
      const userId = 'user-separate-topics';

      const events1: unknown[] = [];
      const events2: unknown[] = [];

      const subject1 = expectSubject(await service.subscribe(userId, ['dm']));
      const subject2 = expectSubject(await service.subscribe(userId, ['notifications']));

      const sub1 = subject1.subscribe((event: unknown) => {
        events1.push(event);
      });

      const sub2 = subject2.subscribe((event: unknown) => {
        events2.push(event);
      });

      const dmEvent = { event: 'dm.msg', data: 'dm data' };
      const notifEvent = { event: 'notifications.alert', data: 'notif data' };

      void service.publish(userId, dmEvent);
      void service.publish(userId, notifEvent);

      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      expect(events1).toEqual([dmEvent]);
      expect(events2).toEqual([notifEvent]);

      sub1.unsubscribe();
      sub2.unsubscribe();
    });
  });
});
