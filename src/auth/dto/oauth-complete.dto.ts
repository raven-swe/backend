import { IsString, IsDateString, IsNotEmpty } from 'class-validator';

export class OauthCompleteDto {
  @IsNotEmpty()
  @IsString()
  creationToken: string;
  @IsNotEmpty()
  @IsDateString()
  birthDate: string;
}
