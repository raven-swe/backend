import { IsEmail, IsString, IsDate, IsNotEmpty } from 'class-validator';

export class StartRegistrationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsDate()
  @IsNotEmpty()
  dateOfBirth: Date;

  @IsString()
  @IsNotEmpty()
  recaptchaToken: string;
}
