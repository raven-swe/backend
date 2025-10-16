import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class CompleteRegistrationDto {
  @IsString()
  @MinLength(10, { message: 'Password should be at least 10 characters' })
  @Matches(/[A-Z]/, { message: 'Must contain at least one uppercase letter' })
  @Matches(/[a-z]/, { message: 'Must contain at least one lowercase letter' })
  @Matches(/[0-9]/, { message: 'Must contain at least one number' })
  @Matches(/[^A-Za-z0-9]/, {
    message: 'Password must contain at least one symbol',
  })
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  creationToken: string;
}
