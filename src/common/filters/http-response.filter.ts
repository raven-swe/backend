import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  ValidationError,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorResponse, ApiValidationErrorResponse } from '../interfaces/response.interface';
import { CONSTRAINT_TO_ERROR_CODE_MAP } from '../constants/validation-error-codes';
import { MAX_FILE_SIZE_BYTES } from 'src/media/constants/media.constant';
import { AppLogger } from 'src/logger/logger.service';
import { Prisma } from '@prisma/client';
@Catch()
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}
  private readonly isProduction = process.env.NODE_ENV === 'production';

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

    const logMeta: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Handle validation errors (from class-validator or called from createValidationError.util)
      if (status === HttpStatus.BAD_REQUEST && this.isValidationErrorArray(exceptionResponse)) {
        const message = (exceptionResponse as { message: ValidationError[] }).message;
        errorResponse = this.formatValidationErrors(message);
        status = HttpStatus.UNPROCESSABLE_ENTITY;
      } else {
        // standard http execptions
        errorResponse = this.formatHttpException(status, exceptionResponse);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const { status: prismaStatus, response: prismaResponse } = this.formatPrismaError(exception);
      status = prismaStatus;
      errorResponse = prismaResponse;
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

    // stack traces in dev for all errors except validation ones, they're too much noise, I include the reposnse instead
    if (!this.isProduction) {
      if (exception instanceof Error)
        if (status !== HttpStatus.UNPROCESSABLE_ENTITY) logMeta.stack = exception.stack;
        else logMeta.response = errorResponse;
    } else {
      // stack traces in prod only for 500 and prisma errors
      if (
        status >= HttpStatus.INTERNAL_SERVER_ERROR ||
        exception instanceof Prisma.PrismaClientKnownRequestError
      ) {
        if (exception instanceof Error) logMeta.stack = exception.stack;
      }
    }
    const logMessage = `${request.method} ${request.url} ${status} - ${errorResponse.error.message || ''}`;

    if (
      status >= HttpStatus.INTERNAL_SERVER_ERROR ||
      exception instanceof Prisma.PrismaClientKnownRequestError
    ) {
      this.logger.error(logMessage, logMeta);
    } else {
      this.logger.warn(logMessage, logMeta);
    }

    response.status(status).json(errorResponse);
  }

  private formatValidationErrors(validationErrors: ValidationError[]): ApiValidationErrorResponse {
    const seen = new Set<string>();

    const formattedErrors = validationErrors.reduce(
      (acc, error) => {
        if (
          error &&
          typeof error === 'object' &&
          'property' in error &&
          'constraints' in error &&
          error.constraints
        ) {
          const field = error.property;

          // Ensure only the first error per field is added
          if (!seen.has(field)) {
            seen.add(field);

            // Get the first constraint key and message (should only be one anyway)
            const [constraintKey, message] = Object.entries(error.constraints)[0];

            acc.push({
              field,
              code: CONSTRAINT_TO_ERROR_CODE_MAP[constraintKey] || constraintKey.toUpperCase(),
              message,
            });
          }
        } else {
          // Fallback for string or unknown errors
          acc.push({
            field: 'unknown',
            code: 'INVALID_VALUE',
            message: typeof error === 'string' ? error : JSON.stringify(error),
          });
        }
        return acc;
      },
      [] as { field: string; code: string; message: string }[],
    );

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
    const additionalFields: Record<string, unknown> = {};

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
      case Number(HttpStatus.PAYLOAD_TOO_LARGE):
        code = 'PAYLOAD_TOO_LARGE';
        message = `Payload size exceeds the allowable limit (${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB)`;
        break;
      default:
        code = 'INTERNAL_SERVER_ERROR';
    }

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object') {
      if (
        'message' in exceptionResponse &&
        Number(status) !== Number(HttpStatus.PAYLOAD_TOO_LARGE)
      ) {
        message = exceptionResponse['message'] as string;
      }
    }

    //if it had its own code
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      if ('code' in exceptionResponse) {
        code = exceptionResponse['code'] as string;
      }
      Object.entries(exceptionResponse).forEach(([key, value]) => {
        if (key !== 'code' && key !== 'message') {
          additionalFields[key] = value;
        }
      });
    }

    return {
      success: false,
      error: {
        code,
        message,
        ...additionalFields,
      },
    };
  }

  private formatPrismaError(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    response: ApiErrorResponse;
  } {
    let status = HttpStatus.BAD_REQUEST;
    let code = 'DB_ERROR';
    let message = 'An unexpected error occurred';
    const meta = exception.meta;

    switch (exception.code) {
      case 'P2002': {
        // Unique constraint
        // may get triggered on some edge cases
        status = HttpStatus.CONFLICT;
        code = 'ALREADY_EXISTS';
        const target = meta?.target as string[];
        message = target
          ? `Unique constraint failed on the fields: (${target.join(', ')})`
          : 'Record already exists';
        break;
      }

      case 'P2025': // Record not found
        status = HttpStatus.NOT_FOUND;
        code = 'NOT_FOUND';
        message = 'The record you are trying to access does not exist';
        break;

      case 'P2003': // Foreign key violations
        // this would normally not be hit
        status = HttpStatus.BAD_REQUEST;
        code = 'INVALID_RELATION';
        message = 'Operation depends on a record that does not exist';
        break;

      default:
        // hopefully we never hit this :)
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        this.logger.error(`Unhandled Database error: ${exception.message}`);
        break;
    }

    return {
      status,
      response: {
        success: false,
        error: {
          code,
          message,
        },
      },
    };
  }

  private isValidationErrorArray(val: unknown): val is { message: ValidationError[] } {
    if (typeof val !== 'object' || val === null || !('message' in val)) {
      return false;
    }

    const message = (val as Record<string, unknown>).message as unknown[];

    if (!Array.isArray(message) || message.length === 0) {
      return false;
    }

    const first = message[0];
    return (
      typeof first === 'object' && first !== null && 'property' in first && 'constraints' in first
    );
  }
}
