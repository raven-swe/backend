import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MediaUrlService } from '../media-url';

/*
 * Interceptor that resolves media URLs to absolute URLs.
 */
@Injectable()
export class MediaUrlInterceptor implements NestInterceptor {
  constructor(private readonly mediaUrlService: MediaUrlService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data: unknown) => this.mediaUrlService.resolve(data)));
  }
}
