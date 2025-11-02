import { IsNotEmpty, IsString } from 'class-validator';

export class RemoveUserSSODto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;
}
