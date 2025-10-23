import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { VALIDATION_ERROR_CODES } from 'src/common/validation-error-codes';

export class VerifyOtpDto {
  @IsString({ context: VALIDATION_ERROR_CODES.NOT_A_STRING })
  @MinLength(6, { context: VALIDATION_ERROR_CODES.TOO_SHORT })
  @MaxLength(6, { context: VALIDATION_ERROR_CODES.TOO_LONG })
  @IsNotEmpty({ context: VALIDATION_ERROR_CODES.IS_EMPTY })
  otp: string;

  @IsString({ context: VALIDATION_ERROR_CODES.NOT_A_STRING })
  @IsNotEmpty({ context: VALIDATION_ERROR_CODES.IS_EMPTY })
  creationToken: string;
}
