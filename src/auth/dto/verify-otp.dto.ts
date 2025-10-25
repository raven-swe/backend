import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  @IsNotEmpty()
  otp: string;

  @IsString()
  @IsNotEmpty()
  creationToken: string;
}
