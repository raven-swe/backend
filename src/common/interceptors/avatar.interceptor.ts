import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DEFAULT_PROFILE_PICTURE } from 'src/users/constants';

@Injectable()
export class AvatarUrlInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        this.mutateData(data);
        return data;
      }),
    );
  }

  private mutateData(value: unknown): void {
    // 1. Fast Fail: Nulls, primitives, or Dates
    if (!value || typeof value !== 'object' || value instanceof Date) {
      return;
    }

    // 2. Handle Array (Iterate)
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        this.mutateData(value[i]);
      }
      return;
    }

    // 3. Handle Object (Mutate specific key)
    if ('avatarUrl' in value && value.avatarUrl === null) {
      value.avatarUrl = DEFAULT_PROFILE_PICTURE;
    }

    // 4. Recurse deeper (Standard for-in loop is fastest here)
    for (const key in value) {
      const child = (value as Record<string, unknown>)[key];
      if (typeof child === 'object' && child !== null) {
        this.mutateData(child);
      }
    }
  }
}
