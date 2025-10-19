import { IsString } from 'class-validator';

export class LogoutDto {
  @IsString()
  refresh_token: string;
}
