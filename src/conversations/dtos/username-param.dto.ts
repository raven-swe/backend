import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UsernameParamDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  username: string;
}
