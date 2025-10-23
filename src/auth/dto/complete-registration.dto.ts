import { IsEnum, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { DeviceType } from 'src/device/interfaces/device.interface';
import { VALIDATION_ERROR_CODES } from 'src/common/validation-error-codes';
export class CompleteRegistrationDto {
  @IsString()
  @MinLength(10, {
    context: VALIDATION_ERROR_CODES.TOO_SHORT,
  })
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).*$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one symbol',
    context: VALIDATION_ERROR_CODES.INVALID_FORMAT,
  })
  @IsNotEmpty({ context: VALIDATION_ERROR_CODES.IS_EMPTY })
  password: string;

  @IsString({ context: VALIDATION_ERROR_CODES.NOT_A_STRING })
  @IsNotEmpty({ context: VALIDATION_ERROR_CODES.IS_EMPTY })
  creationToken: string;

  @IsEnum(DeviceType, {
    message: 'Invalid device type',
    context: VALIDATION_ERROR_CODES.INVALID_ENUM_VALUE,
  })
  @IsNotEmpty({ context: VALIDATION_ERROR_CODES.IS_EMPTY })
  deviceType: DeviceType;
}
