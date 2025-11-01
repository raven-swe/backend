import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ApiSuccessResponse,
  ApiSuccessResponseWithPagination,
  CursorPagination,
} from '../interfaces/response.interface';

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
