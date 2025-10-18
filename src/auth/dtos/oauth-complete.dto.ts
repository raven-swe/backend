import { IsString } from 'class-validator';

export class OauthCompleteDto {
  @IsString()
  creationToken: string;
  @IsString()
  birthDate: string;
}
