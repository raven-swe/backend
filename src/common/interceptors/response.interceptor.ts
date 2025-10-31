import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccessResponse } from '../interfaces/response.interface';

interface RedirectResponse {
  url: string;
  statusCode?: number;
}

function isRedirectResponse(data: unknown): data is RedirectResponse {
  return (
    data !== null &&
    data !== undefined &&
    typeof data === 'object' &&
    'url' in data &&
    typeof (data as Record<string, unknown>).url === 'string' &&
    Object.keys(data).every((k) => k === 'url' || k === 'statusCode')
  );
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiSuccessResponse<T>> {
    return next.handle().pipe(
      map((data: unknown): ApiSuccessResponse<T> => {
        // If controller returned a Redirect response shape, pass through unchanged
        if (isRedirectResponse(data)) {
          return data as unknown as ApiSuccessResponse<T>;
        }

        const responseData = data as Record<string, unknown>;
        const { message, ...rest } = responseData;
        return {
          success: true,
          message: message as string | undefined,
          data: rest as T,
        };
      }),
    );
  }
}
