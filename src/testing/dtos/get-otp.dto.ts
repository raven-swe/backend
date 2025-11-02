import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum TestingOtpType {
  REGISTRATION = 'registration',
  FORGOT_PASSWORD = 'forgotPassword',
  CHANGE_EMAIL = 'changeEmail',
}

export class GetOtpDto {
  @IsEnum(TestingOtpType)
  @IsNotEmpty()
  type: TestingOtpType; // registration, forgotPassword, changeEmail

  @IsString()
  @IsNotEmpty()
  identifier: string; // This will be the email in case of registration and forgotPassword, and userId in case of changeEmail
}
