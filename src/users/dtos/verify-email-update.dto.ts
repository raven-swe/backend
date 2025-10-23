import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyEmailUpdateDto {
  @IsString()
  @Length(6, 6)
  @IsNotEmpty()
  otp: string;

  @IsString()
  @IsNotEmpty()
  confirmationToken: string;
}
