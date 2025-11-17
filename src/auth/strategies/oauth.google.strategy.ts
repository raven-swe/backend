import { OAuthProviderStrategy } from './oauth.provider.strategy';
import { ProviderProfile } from '../interfaces/oauth.inteface';
import { BadRequestException, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { createValidationError } from 'src/common/utils/create-validation-error.util';

interface GoogleUserResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  id_token: string;
}

export class GoogleOAuthStrategy implements OAuthProviderStrategy {
  private client: OAuth2Client;

  constructor(private readonly config: ConfigService) {
    this.client = new OAuth2Client(this.config.get<string>('GOOGLE_CLIENT_ID'));
  }

  async validateToken(providerToken: string, clientType: string): Promise<ProviderProfile> {
    const redirectUri =
      clientType === 'mobile'
        ? this.config.get<string>('GOOGLE_REDIRECT_URI_MOBILE')!
        : this.config.get<string>('GOOGLE_REDIRECT_URI_WEB')!;

    Logger.log(clientType, 'Client of GoogleOAuthStrategy');
    Logger.log(redirectUri, 'GoogleOAuthStrategy');

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: providerToken,
        client_id: this.config.get<string>('GOOGLE_CLIENT_ID')!,
        client_secret: this.config.get<string>('GOOGLE_CLIENT_SECRET')!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!res.ok) {
      throw new BadRequestException(
        createValidationError('providerToken', {
          invalidValue:
            'The Google authorization token is invalid or expired. Please try logging in again.',
        }),
      );
    }

    const googleData = (await res.json()) as GoogleUserResponse;

    if (!googleData.id_token)
      throw new BadRequestException('Failed to obtain user from Google. Please try again.');

    const ticket = await this.client.verifyIdToken({
      idToken: googleData.id_token,
      audience: this.config.get<string>('GOOGLE_CLIENT_ID'),
    });

    if (!ticket) throw new BadRequestException('Failed to verify Google user. Please try again.');

    const ticketPayload = ticket.getPayload();

    if (!ticketPayload || !ticketPayload.email || !ticketPayload.name) {
      throw new UnauthorizedException('Incomplete Google user profile information');
    }

    const payload: ProviderProfile = {
      provider: 'google',
      id: ticketPayload.sub,
      email: ticketPayload.email,
      name: ticketPayload.name,
      avatar_url: ticketPayload.picture || null,
    };

    return payload;
  }
}
