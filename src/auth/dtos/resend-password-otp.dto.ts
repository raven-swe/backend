import { IsString, IsNotEmpty } from 'class-validator';

export class ResendPasswordOtpDto {
  @IsString({ message: 'Confirmation token must be a string' })
  @IsNotEmpty()
  confirmationToken: string;
}
