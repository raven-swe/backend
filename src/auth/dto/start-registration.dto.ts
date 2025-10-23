import {
  IsEmail,
  IsString,
  IsDate,
  IsNotEmpty,
  ValidationOptions,
  registerDecorator,
  ValidationArguments,
} from 'class-validator';
import { VALIDATION_ERROR_CODES } from 'src/common/validation-error-codes';
export class StartRegistrationDto {
  @IsString({ context: VALIDATION_ERROR_CODES.NOT_A_STRING })
  @IsNotEmpty({ context: VALIDATION_ERROR_CODES.IS_EMPTY })
  name: string;

  @IsEmail({}, { context: VALIDATION_ERROR_CODES.NOT_AN_EMAIL })
  @IsNotEmpty({ context: VALIDATION_ERROR_CODES.IS_EMPTY })
  email: string;

  @IsDate({ context: VALIDATION_ERROR_CODES.NOT_A_DATE })
  @IsNotEmpty({ context: VALIDATION_ERROR_CODES.IS_EMPTY })
  @IsMinYearsOld(18, {
    message: 'You must be at least 18 years old to register',
    context: VALIDATION_ERROR_CODES.NOT_MINIMUM_AGE,
  })
  birthDate: Date;

  @IsString({ context: VALIDATION_ERROR_CODES.NOT_A_STRING })
  @IsNotEmpty({ context: VALIDATION_ERROR_CODES.IS_EMPTY })
  recaptchaToken: string;
}

function IsMinYearsOld(minYears: number, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isMinYearsOld',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [minYears],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (!(value instanceof Date)) {
            return false; // Ensure the value is a Date object
          }
          const constraintMinYears =
            Array.isArray(args.constraints) && typeof args.constraints[0] === 'number'
              ? args.constraints[0]
              : minYears;
          const today = new Date();
          const minDate = new Date(
            today.getFullYear() - constraintMinYears,
            today.getMonth(),
            today.getDate(),
          );
          return value <= minDate;
        },
        defaultMessage(args: ValidationArguments) {
          const constraintMinYears =
            Array.isArray(args.constraints) && typeof args.constraints[0] === 'number'
              ? args.constraints[0]
              : minYears;
          return `${args.property} must be at least ${constraintMinYears} years old.`;
        },
      },
    });
  };
}
