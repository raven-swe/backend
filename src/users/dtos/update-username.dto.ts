import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';

export class UpdateUsernameDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  @Matches(/[a-zA-Z]/, {
    message: 'Username must contain at least one letter.',
  })
  newUsername: string;
}
