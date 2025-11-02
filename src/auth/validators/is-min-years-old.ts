import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function IsMinYearsOld(minYears: number, validationOptions?: ValidationOptions) {
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
