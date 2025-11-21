import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

@Injectable()
export class SseService {
  private subjects = new Map<string, Subject<unknown>>();

  subscribe(userId: string) {
    if (!this.subjects.has(userId)) {
      this.subjects.set(userId, new Subject());
    }
    return this.subjects.get(userId)!.asObservable();
  }

  publish(userId: string, event: unknown) {
    const sub = this.subjects.get(userId);
    if (sub) sub.next(event);
  }

  unsubscribe(userId: string) {
    const sub = this.subjects.get(userId);
    if (sub) {
      sub.complete();
      this.subjects.delete(userId);
    }
  }
}
