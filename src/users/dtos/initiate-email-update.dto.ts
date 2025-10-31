import { IsEmail, IsNotEmpty } from 'class-validator';

export class InititateEmailUpdateDto {
  @IsEmail()
  @IsNotEmpty()
  newEmail: string;
}
