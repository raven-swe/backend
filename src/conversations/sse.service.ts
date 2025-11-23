import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

const MAX_CONNECTIONS_PER_USER = 5;

@Injectable()
export class SseService {
  private subjects = new Map<string, Subject<unknown>[]>();

  subscribe(userId: string): Subject<unknown> | null {
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

  publish(userId: string, event: unknown) {
    const userSubjects = this.subjects.get(userId);
    if (userSubjects) {
      userSubjects.forEach((subject) => {
        subject.next(event);
      });
    }
  }

  unsubscribe(userId: string, subject: Subject<unknown>) {
    const userSubjects = this.subjects.get(userId);
    if (userSubjects) {
      const index = userSubjects.indexOf(subject);
      if (index > -1) {
        subject.complete();
        userSubjects.splice(index, 1);
      }

      if (userSubjects.length === 0) {
        this.subjects.delete(userId);
      }
    }
  }

  getConnectionCount(userId: string): number {
    return this.subjects.get(userId)?.length ?? 0;
  }
}
