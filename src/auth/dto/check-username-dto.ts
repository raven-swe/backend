import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';

export class CheckUsernameDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  @MaxLength(15)
  username: string;
}
