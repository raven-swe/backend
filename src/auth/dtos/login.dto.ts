import { IsAlphanumeric, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  @IsString()
  @IsAlphanumeric()
  identifier: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password: string;
}
