import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Type,
} from '@nestjs/common';
import { plainToInstance, ClassConstructor } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { createValidationError } from 'src/common/utils/create-validation-error.util';

@Injectable()
export class ParseJsonBodyPipe implements PipeTransform {
  async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    // If value is already an object (not multipart form data), return as is
    if (typeof value !== 'string') {
      return value;
    }

    // Parse JSON string
    let parsedValue: unknown;
    try {
      parsedValue = JSON.parse(value) as unknown;
    } catch (error) {
      console.error('Failed to parse JSON:', error);

      throw new BadRequestException(
        createValidationError('data', {
          invalidJson: 'The "data" field must be a valid JSON string.',
        }),
      );
    }

    // Transform to DTO class instance
    const { metatype } = metadata;
    if (!metatype || !this.toValidate(metatype)) {
      return parsedValue;
    }

    // Ensure parsedValue is an object before transformation
    if (typeof parsedValue !== 'object' || parsedValue === null) {
      throw new BadRequestException(
        createValidationError('data', {
          invalidData: 'The "data" field must be a valid object.',
        }),
      );
    }

    const object = plainToInstance(
      metatype as ClassConstructor<Record<string, unknown>>,
      parsedValue as Record<string, unknown>,
    );

    // Validate the DTO
    const errors: ValidationError[] = await validate(object as object, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      const firstError = errors[0];
      const constraints = firstError.constraints;
      const errorMessage = constraints ? Object.values(constraints)[0] : 'Validation failed';

      throw new BadRequestException(
        createValidationError(firstError.property, {
          validationFailed: errorMessage,
        }),
      );
    }

    return object;
  }

  private toValidate(metatype: Type<unknown>): boolean {
    const types: Array<Type<unknown>> = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
