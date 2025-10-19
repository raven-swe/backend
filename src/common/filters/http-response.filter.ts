import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  ValidationError,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorResponse, ApiValidationErrorResponse } from '../interfaces/response.interface';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Default to internal server error
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: ApiErrorResponse | ApiValidationErrorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      const isValidationErrorArray = (val: unknown): val is { message: ValidationError[] } => {
        if (typeof val !== 'object' || val === null || !('message' in val)) {
          return false;
        }

        const message = (val as Record<string, unknown>).message as unknown[];

        if (!Array.isArray(message) || message.length === 0) {
          return false;
        }

        const first = message[0];
        return (
          typeof first === 'object' &&
          first !== null &&
          'property' in first &&
          'constraints' in first
        );
      };

      // Handle validation errors (typically from class-validator)
      if (status === HttpStatus.BAD_REQUEST && isValidationErrorArray(exceptionResponse)) {
        this.logger.warn(`Validation failed: ${JSON.stringify(exceptionResponse)}`);
        const message = (exceptionResponse as { message: ValidationError[] }).message;
        errorResponse = this.formatValidationErrors(message);
      } else {
        // standard http execptions
        errorResponse = this.formatHttpException(status, exceptionResponse);
      }
    } else if (exception instanceof Error) {
      // Handle regular errors
      errorResponse = {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
      };
    } else {
      // Handle unknown exceptions
      errorResponse = {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
      };
    }

    this.logger.error(
      `${request.method} ${request.url} ${status}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(status).json(errorResponse);
  }

  private formatValidationErrors(validationErrors: unknown[]): ApiValidationErrorResponse {
    const formattedErrors = validationErrors.flatMap((error) => {
      if (
        error &&
        typeof error === 'object' &&
        'property' in error &&
        'constraints' in error &&
        (error as ValidationError).constraints
      ) {
        return Object.values((error as ValidationError).constraints!).map((message) => ({
          field: (error as ValidationError).property,
          code: 'INVALID_VALUE',
          message,
        }));
      }
      // fallback for string errors
      return [
        {
          field: 'unknown',
          code: 'INVALID_VALUE',
          message: typeof error === 'string' ? error : JSON.stringify(error),
        },
      ];
    });

    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors: formattedErrors,
      },
    };
  }

  private formatHttpException(
    status: number,
    exceptionResponse: string | object,
  ): ApiErrorResponse {
    let code: string;
    let message: string = 'An unexpected error occurred';

    switch (Number(status)) {
      case Number(HttpStatus.BAD_REQUEST):
        code = 'INVALID_INPUT';
        break;
      case Number(HttpStatus.UNAUTHORIZED):
        code = 'UNAUTHORIZED';
        break;
      case Number(HttpStatus.FORBIDDEN):
        code = 'FORBIDDEN';
        break;
      case Number(HttpStatus.NOT_FOUND):
        code = 'NOT_FOUND';
        break;
      case Number(HttpStatus.CONFLICT):
        code = 'ALREADY_EXISTS';
        break;
      case Number(HttpStatus.TOO_MANY_REQUESTS):
        code = 'RATE_LIMIT_EXCEEDED';
        break;
      default:
        code = 'INTERNAL_SERVER_ERROR';
    }

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object') {
      if ('message' in exceptionResponse) {
        message = exceptionResponse['message'] as string;
      }
    }

    //if it had its own code
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      if ('code' in exceptionResponse) {
        code = exceptionResponse['code'] as string;
      }
    }

    return {
      success: false,
      error: {
        code,
        message,
      },
    };
  }
}
