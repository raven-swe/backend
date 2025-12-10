import { IsString } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  fcmToken: string;
}
