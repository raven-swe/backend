import { Test, TestingModule } from '@nestjs/testing';
import { SseService } from 'src/conversations/sse.service';
import { Subject } from 'rxjs';
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
      const subject = service.subscribe(userId);

      expect(subject).toBeDefined();
      expect(subject).not.toBeNull();

      const subscription = subject!.pipe(take(1)).subscribe({
        next: (event) => {
          expect(event).toEqual({ test: 'event' });
          subscription.unsubscribe();
          done();
        },
      });

      service.publish(userId, { test: 'event' });
    });

    it('should create separate subjects for multiple subscriptions of the same user', () => {
      const userId = 'user-456';

      const subject1 = service.subscribe(userId);
      const subject2 = service.subscribe(userId);

      expect(subject1).not.toBeNull();
      expect(subject2).not.toBeNull();

      let receivedEvents1 = 0;
      let receivedEvents2 = 0;

      subject1!.pipe(take(1)).subscribe(() => {
        receivedEvents1++;
      });

      subject2!.pipe(take(1)).subscribe(() => {
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

      const subject1 = service.subscribe(userId1);
      const subject2 = service.subscribe(userId2);

      expect(subject1).not.toBeNull();
      expect(subject2).not.toBeNull();

      const sub1 = subject1!.subscribe((event) => {
        events1.push(event);
      });

      const sub2 = subject2!.subscribe((event) => {
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

    it('should limit connections per user to 5 and complete oldest when exceeded', (done) => {
      const userId = 'user-max-connections';
      const subjects: (Subject<unknown> | null)[] = [];

      for (let i = 0; i < 5; i++) {
        const subject = service.subscribe(userId);
        expect(subject).not.toBeNull();
        subjects.push(subject);
      }

      let oldestCompleted = false;
      subjects[0]!.subscribe({
        complete: () => {
          oldestCompleted = true;
        },
      });

      const sixthSubject = service.subscribe(userId);
      expect(sixthSubject).not.toBeNull();

      setTimeout(() => {
        expect(oldestCompleted).toBe(true);
        expect(service.getConnectionCount(userId)).toBe(5);
        done();
      }, 100);
    });

    it('should return connection count for a user', () => {
      const userId = 'user-count';

      expect(service.getConnectionCount(userId)).toBe(0);

      service.subscribe(userId);
      expect(service.getConnectionCount(userId)).toBe(1);

      service.subscribe(userId);
      expect(service.getConnectionCount(userId)).toBe(2);
    });
  });

  describe('publish', () => {
    it('should publish events to subscribed users', (done) => {
      const userId = 'user-789';
      const testEvent = { type: 'test', data: 'hello' };

      const subject = service.subscribe(userId);
      expect(subject).not.toBeNull();

      const subscription = subject!.subscribe((event) => {
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

      const subject = service.subscribe(userId);
      expect(subject).not.toBeNull();

      const subscription = subject!.subscribe((event) => {
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

      const subject = service.subscribe(userId);
      expect(subject).not.toBeNull();

      const subscription = subject!.subscribe({
        next: () => {},
        complete: () => {
          completed = true;
        },
      });

      service.unsubscribe(userId, subject!);

      setTimeout(() => {
        expect(completed).toBe(true);
        subscription.unsubscribe();
        done();
      }, 100);
    });

    it('should not throw error when unsubscribing a non-existent user', () => {
      const subject = service.subscribe('temp-user');
      expect(() => {
        service.unsubscribe('non-existent-user', subject!);
      }).not.toThrow();
    });

    it('should allow re-subscribing after unsubscribe', (done) => {
      const userId = 'user-resubscribe';

      const subject1 = service.subscribe(userId);
      expect(subject1).not.toBeNull();

      const sub1 = subject1!.subscribe();
      service.unsubscribe(userId, subject1!);
      sub1.unsubscribe();

      const subject2 = service.subscribe(userId);
      expect(subject2).not.toBeNull();

      const subscription = subject2!.subscribe((event) => {
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

      const subject1 = service.subscribe(userId1);
      const subject2 = service.subscribe(userId2);

      expect(subject1).not.toBeNull();
      expect(subject2).not.toBeNull();

      const sub1 = subject1!.subscribe();
      const sub2 = subject2!.subscribe((event) => {
        events2.push(event);
      });

      service.unsubscribe(userId1, subject1!);
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
