import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccessResponse } from '../interfaces/response.interface';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiSuccessResponse<T>> {
    return next.handle().pipe(
      map((response: Record<string, unknown> | unknown[]) => {
        if (Array.isArray(response)) {
          return {
            success: true,
            data: response as T,
          };
        }

        const { message, ...rest } = response;
        return {
          success: true,
          message: message as string | undefined,
          data: rest as T,
        };
      }),
    );
  }
}
