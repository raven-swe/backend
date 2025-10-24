import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateUsernameDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  newUsername: string;
}
