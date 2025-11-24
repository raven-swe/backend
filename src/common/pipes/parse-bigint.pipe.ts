import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { createValidationError } from 'src/common/utils/create-validation-error.util';
import { VALIDATION_PIPE_ERROR_MESSAGES } from '../constants/common.constant';

@Injectable()
export class ParseBigIntPipe implements PipeTransform<string, bigint> {
  transform(value: string): bigint {
    try {
      const bigIntValue = BigInt(value);
      if (bigIntValue < 0) {
        throw new BadRequestException(
          createValidationError('id', {
            invalidParam: VALIDATION_PIPE_ERROR_MESSAGES.NEGATIVE_BIGINT,
          }),
        );
      }
      return bigIntValue;
    } catch (error) {
      console.error('ParseBigIntPipe Error:', error);
      throw new BadRequestException(
        createValidationError('id', {
          invalidParam: VALIDATION_PIPE_ERROR_MESSAGES.INVALID_BIGINT,
        }),
      );
    }
  }
}
