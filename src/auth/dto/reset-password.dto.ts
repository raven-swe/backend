import { IsNotEmpty, IsString } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  confirmationToken: string;

  @IsString()
  @IsNotEmpty()
  newPassword: string;
}
