import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccessResponse } from '../interfaces/response.interface';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiSuccessResponse<T>> {
    return next.handle().pipe(
      map((data: any) => {
        // Check if the response is a redirect shape
        // If so, return it as is
        const isRedirectShape =
          data &&
          typeof data === 'object' &&
          'url' in data &&
          typeof (data as any).url === 'string' &&
          Object.keys(data).every((k) => k === 'url' || k === 'statusCode');
        if (isRedirectShape) {
          return data;
        }

        const { message, ...rest } = data as Record<string, unknown>;
        return {
          success: true,
          message: message as string | undefined,
          data: rest as T,
        };
      }),
    );
  }
}
