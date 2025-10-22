import { IsNotEmpty, IsString } from 'class-validator';

export class ChangePasswordBasicDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  newPassword: string;
}
