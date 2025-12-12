import { IsString } from 'class-validator';
import { RefreshTokenDto } from './refresh-token.dto';

export class LogoutDto extends RefreshTokenDto {
  @IsString()
  fcmToken?: string;
}
