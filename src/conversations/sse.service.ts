import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

@Injectable()
export class SseService {
  private subjects = new Map<string, Map<string, Subject<unknown>>>();

  subscribe(userId: string, deviceId: string) {
    if (!this.subjects.has(userId)) {
      this.subjects.set(userId, new Map());
    }

    const userDevices = this.subjects.get(userId)!;
    if (!userDevices.has(deviceId)) {
      userDevices.set(deviceId, new Subject());
    }

    return userDevices.get(deviceId)!.asObservable();
  }

  publish(userId: string, event: unknown) {
    const userDevices = this.subjects.get(userId);
    if (userDevices) {
      userDevices.forEach((subject) => {
        subject.next(event);
      });
    }
  }

  unsubscribe(userId: string, deviceId: string) {
    const userDevices = this.subjects.get(userId);
    if (userDevices) {
      const sub = userDevices.get(deviceId);
      if (sub) {
        sub.complete();
        userDevices.delete(deviceId);
      }

      if (userDevices.size === 0) {
        this.subjects.delete(userId);
      }
    }
  }
}
