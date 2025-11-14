import {
  IsEmail,
  IsString,
  IsDate,
  IsNotEmpty,
  MaxLength,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';

import { IsMinYearsOld } from '../validators/is-min-years-old';

export class StartRegistrationDto {
  @IsNotEmpty()
  @IsString()
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
          return /[a-zA-Z\u0600-\u06FF]/.test(value);
        },
      },
    });
  };
}
