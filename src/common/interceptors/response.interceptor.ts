import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ApiSuccessResponse,
  ApiSuccessResponseWithPagination,
  CursorPagination,
} from '../interfaces/response.interface';

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
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiSuccessResponse<T> | ApiSuccessResponseWithPagination<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiSuccessResponse<T> | ApiSuccessResponseWithPagination<T>> {
    return next.handle().pipe(
      map((response: Record<string, unknown> | unknown[]) => {
        // If controller returned a Redirect response shape, pass through unchanged
        if (isRedirectResponse(response)) {
          return response as unknown as ApiSuccessResponse<T>;
        }

        if (Array.isArray(response)) {
          return {
            success: true,
            data: response as T,
          };
        }

        if (
          response &&
          typeof response === 'object' &&
          'items' in response &&
          'pagination' in response
        ) {
          const { message, items, pagination } = response;
          return {
            success: true,
            message: message as string | undefined,
            data: items as T,
            pagination: pagination as CursorPagination,
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
