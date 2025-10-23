import {
  IsEmail,
  IsString,
  IsDate,
  IsNotEmpty,
  ValidationOptions,
  registerDecorator,
  ValidationArguments,
} from 'class-validator';
export class StartRegistrationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsDate()
  @IsNotEmpty()
  @IsMinYearsOld(18, {
    message: 'You must be at least 18 years old to register',
  })
  birthDate: Date;

  @IsString()
  @IsNotEmpty()
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
