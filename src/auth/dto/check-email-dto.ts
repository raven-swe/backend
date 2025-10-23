import { IsEmail, IsNotEmpty } from 'class-validator';
import { VALIDATION_ERROR_CODES } from 'src/common/validation-error-codes';
export class CheckEmailDto {
  @IsEmail({}, { context: VALIDATION_ERROR_CODES.NOT_AN_EMAIL })
  @IsNotEmpty({ context: VALIDATION_ERROR_CODES.IS_EMPTY })
  email: string;
}
