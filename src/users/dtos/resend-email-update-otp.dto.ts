import { IsString, IsNotEmpty } from 'class-validator';

export class ResendEmailUpdateOtp {
  @IsString()
  @IsNotEmpty()
  confirmationToken: string;
}
