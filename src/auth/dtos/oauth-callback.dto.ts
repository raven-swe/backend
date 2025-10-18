import { IsString } from 'class-validator';
import { Expose } from 'class-transformer';

export class OauthCallbackDto {
  @Expose({ name: 'provider_token_id' })
  @IsString()
  providerTokenId: string;
}
