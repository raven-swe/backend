import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Length(6, 6)
  @IsNotEmpty()
  otp: string;

  @IsString()
  @IsNotEmpty()
  token: string;
}
