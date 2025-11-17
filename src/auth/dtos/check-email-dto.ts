import { IsEmail, IsNotEmpty } from 'class-validator';
export class CheckEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
