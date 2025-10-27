import { IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  identifier: string;

  @IsNotEmpty()
  password: string;
}
