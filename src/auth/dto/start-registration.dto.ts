import {
  IsEmail,
  IsString,
  IsDate,
  IsNotEmpty,
  MaxLength,
  ValidationOptions,
  registerDecorator,
  ValidationArguments,
} from 'class-validator';
export class StartRegistrationDto {
  @IsString()
  @IsNotEmpty()
  @ContainsLetter()
  @MaxLength(50)
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @IsDate()
  @IsMinYearsOld(13, {
    message: 'You must be at least 13 years old to register',
  })
  birthDate: Date;

  @IsString()
  @IsNotEmpty()
  recaptchaToken: string;
}

function ContainsLetter(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'containsLetter',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: {
        validate(value: string) {
          return /[a-zA-Z]/.test(value);
        },
      },
    });
  };
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
