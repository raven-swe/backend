import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  confirmationToken: string;

  @IsString()
  @MinLength(10)
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).*$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one symbol',
  })
  @IsNotEmpty()
  newPassword: string;
}
