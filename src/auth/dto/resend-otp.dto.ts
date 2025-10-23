import { IsString, IsNotEmpty } from 'class-validator';
import { VALIDATION_ERROR_CODES } from 'src/common/validation-error-codes';

export class ResendOtpDto {
  @IsString({ context: VALIDATION_ERROR_CODES.NOT_A_STRING })
  @IsNotEmpty({ context: VALIDATION_ERROR_CODES.IS_EMPTY })
  creationToken: string;
}
