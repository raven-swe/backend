import { IsNotEmpty, IsString } from 'class-validator';
import { Expose } from 'class-transformer';

export class OauthCallbackDto {
  @IsNotEmpty()
  @IsString()
  @Expose({ name: 'providerToken' })
  providerToken: string;
}
