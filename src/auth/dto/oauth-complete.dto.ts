import {
  IsString,
  IsDateString,
  IsNotEmpty,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

export class OauthCompleteDto {
  @IsNotEmpty()
  @IsString()
  creationToken: string;
  @IsNotEmpty()
  @IsDateString()
  @IsMinYearsOld(13)
  birthDate: string;
}

// Custom validator to check minimum age
// It accepts both date strings and Date objects for safety but for specs we use date strings
// TODO in refactor: move to a shared validators file (hope to see it created one day)
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
          // Handle both ISO string and Date object
          let date: Date;
          if (typeof value === 'string') {
            date = new Date(value);
            if (isNaN(date.getTime())) {
              return false; // Invalid date string
            }
          } else if (value instanceof Date) {
            date = value;
          } else {
            return false; // Invalid type
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
          return date <= minDate;
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
