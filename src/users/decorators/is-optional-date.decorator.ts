import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function IsOptionalDate(errorCode: string, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: errorCode,
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: Date | null | undefined) {
          // Allow undefined (field not provided in request)
          if (value === undefined) {
            return true;
          }

          // Reject null - must provide a valid date if field is sent
          if (value === null) {
            return false;
          }

          // If value is provided, check if it's a valid date
          const date = new Date(value);
          return date instanceof Date && !isNaN(date.getTime());
        },
        defaultMessage(args: ValidationArguments) {
          if (errorCode) {
            return errorCode;
          }
          return `${args.property} must be a valid date`;
        },
      },
    });
  };
}
