import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { createValidationError } from 'src/common/utils/create-validation-error.util';

@Injectable()
export class ParseBigIntPipe implements PipeTransform<string, bigint> {
  transform(value: string): bigint {
    try {
      const bigIntValue = BigInt(value);
      if (bigIntValue < 0) {
        throw new BadRequestException(
          createValidationError('id', {
            invalidParam: 'ID must be a non-negative integer',
          }),
        );
      }
      return bigIntValue;
    } catch (error) {
      console.error('ParseBigIntPipe Error:', error);
      throw new BadRequestException(
        createValidationError('id', {
          invalidParam: 'ID must be a valid integer',
        }),
      );
    }
  }
}
