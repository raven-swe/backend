import { IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  identifier: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password: string;
}
