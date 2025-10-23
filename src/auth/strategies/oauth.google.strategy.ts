import { OAuthProviderStrategy } from './oauth.provider.strategy';
import { ProviderProfile } from '../types/oauth.type';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

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

  async validateToken(providerTokenId: string): Promise<ProviderProfile> {
    // TODO: Implement Google token validation
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: providerTokenId,
        client_id: this.config.get<string>('GOOGLE_CLIENT_ID')!,
        client_secret: this.config.get<string>('GOOGLE_CLIENT_SECRET')!,
        redirect_uri: this.config.get<string>('GOOGLE_REDIRECT_URI')!,
        grant_type: 'authorization_code',
      }),
    });

    if (!res.ok) {
      throw new BadRequestException('Invalid Google token');
    }

    const googleData = (await res.json()) as GoogleUserResponse;

    if (!googleData.id_token) throw new BadRequestException("Couldn't verify the token.");

    const ticket = await this.client.verifyIdToken({
      idToken: googleData.id_token,
      audience: this.config.get<string>('GOOGLE_CLIENT_ID'),
    });

    if (!ticket) {
      throw new UnauthorizedException('Invalid Google token');
    }

    const ticketPayload = ticket.getPayload();

    if (!ticketPayload || !ticketPayload.email || !ticketPayload.name || !ticketPayload.picture) {
      throw new UnauthorizedException(
        'Google profile is missing required fields (email, name, or picture).',
      );
    }

    const payload: ProviderProfile = {
      provider: 'google',
      id: ticketPayload.sub,
      email: ticketPayload.email,
      name: ticketPayload.name,
      avatar_url: ticketPayload.picture,
    };

    return payload;
  }
}
