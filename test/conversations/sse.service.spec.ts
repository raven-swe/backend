import { Test, TestingModule } from '@nestjs/testing';
import { SseService } from 'src/conversations/sse.service';
import { take } from 'rxjs/operators';

describe('SseService', () => {
  let service: SseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SseService],
    }).compile();

    service = module.get<SseService>(SseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('subscribe', () => {
    it('should create a new subject and return an observable for a new user', (done) => {
      const userId = 'user-123';
      const observable = service.subscribe(userId);

      expect(observable).toBeDefined();

      const subscription = observable.pipe(take(1)).subscribe({
        next: (event) => {
          expect(event).toEqual({ test: 'event' });
          subscription.unsubscribe();
          done();
        },
      });

      service.publish(userId, { test: 'event' });
    });

    it('should return the same observable for an existing user subscription', () => {
      const userId = 'user-456';

      const observable1 = service.subscribe(userId);
      const observable2 = service.subscribe(userId);

      let receivedEvents1 = 0;
      let receivedEvents2 = 0;

      observable1.pipe(take(1)).subscribe(() => {
        receivedEvents1++;
      });

      observable2.pipe(take(1)).subscribe(() => {
        receivedEvents2++;
      });

      service.publish(userId, { test: 'shared-event' });

      setTimeout(() => {
        expect(receivedEvents1).toBe(1);
        expect(receivedEvents2).toBe(1);
      }, 100);
    });

    it('should handle multiple users with separate subscriptions', (done) => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';

      const events1: unknown[] = [];
      const events2: unknown[] = [];

      const sub1 = service.subscribe(userId1).subscribe((event) => {
        events1.push(event);
      });

      const sub2 = service.subscribe(userId2).subscribe((event) => {
        events2.push(event);
      });

      service.publish(userId1, { user: 1, message: 'hello' });
      service.publish(userId2, { user: 2, message: 'world' });

      setTimeout(() => {
        expect(events1).toEqual([{ user: 1, message: 'hello' }]);
        expect(events2).toEqual([{ user: 2, message: 'world' }]);

        sub1.unsubscribe();
        sub2.unsubscribe();
        done();
      }, 100);
    });
  });

  describe('publish', () => {
    it('should publish events to subscribed users', (done) => {
      const userId = 'user-789';
      const testEvent = { type: 'test', data: 'hello' };

      const subscription = service.subscribe(userId).subscribe((event) => {
        expect(event).toEqual(testEvent);
        subscription.unsubscribe();
        done();
      });

      service.publish(userId, testEvent);
    });

    it('should not throw error when publishing to non-existent user', () => {
      expect(() => {
        service.publish('non-existent-user', { test: 'event' });
      }).not.toThrow();
    });

    it('should handle multiple events for the same user', (done) => {
      const userId = 'user-multi';
      const events: unknown[] = [];

      const subscription = service.subscribe(userId).subscribe((event) => {
        events.push(event);
      });

      service.publish(userId, { event: 1 });
      service.publish(userId, { event: 2 });
      service.publish(userId, { event: 3 });

      setTimeout(() => {
        expect(events).toEqual([{ event: 1 }, { event: 2 }, { event: 3 }]);
        subscription.unsubscribe();
        done();
      }, 100);
    });
  });

  describe('unsubscribe', () => {
    it('should complete the subject and remove it from the map', (done) => {
      const userId = 'user-to-unsubscribe';

      let completed = false;

      const subscription = service.subscribe(userId).subscribe({
        next: () => {},
        complete: () => {
          completed = true;
        },
      });

      service.unsubscribe(userId);

      setTimeout(() => {
        expect(completed).toBe(true);
        subscription.unsubscribe();
        done();
      }, 100);
    });

    it('should not throw error when unsubscribing a non-existent user', () => {
      expect(() => {
        service.unsubscribe('non-existent-user');
      }).not.toThrow();
    });

    it('should allow re-subscribing after unsubscribe', (done) => {
      const userId = 'user-resubscribe';

      const sub1 = service.subscribe(userId).subscribe();
      service.unsubscribe(userId);
      sub1.unsubscribe();

      const subscription = service.subscribe(userId).subscribe((event) => {
        expect(event).toEqual({ resubscribed: true });
        subscription.unsubscribe();
        done();
      });

      service.publish(userId, { resubscribed: true });
    });

    it('should not affect other users when unsubscribing one user', (done) => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';

      const events2: unknown[] = [];

      const sub1 = service.subscribe(userId1).subscribe();
      const sub2 = service.subscribe(userId2).subscribe((event) => {
        events2.push(event);
      });

      service.unsubscribe(userId1);
      sub1.unsubscribe();

      service.publish(userId2, { message: 'still active' });

      setTimeout(() => {
        expect(events2).toEqual([{ message: 'still active' }]);
        sub2.unsubscribe();
        done();
      }, 100);
    });
  });
});
