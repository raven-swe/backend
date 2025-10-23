import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthProviderStrategy } from './oauth.provider.strategy';
import { ProviderProfile } from '../types/oauth.type';

interface GithubUserResponse {
  id: number | string;
  email: string;
  name: string;
  login: string;
  avatar_url: string;
}

export class GithubOAuthStrategy implements OAuthProviderStrategy {
  constructor(private readonly config: ConfigService) {}

  async validateToken(provider_token_id: string): Promise<ProviderProfile> {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.get<string>('GITHUB_CLIENT_ID')!,
        client_secret: this.config.get<string>('GITHUB_CLIENT_SECRET')!,
        code: provider_token_id,
        redirect_uri: this.config.get<string>('GITHUB_REDIRECT_URI')!,
      }),
    });

    if (!res.ok) {
      throw new BadRequestException('Invalid GitHub code');
    }

    const githubAccess = (await res.json()) as { access_token: string };

    if (!githubAccess.access_token) throw new BadRequestException("Couldn't get the access token");

    const code = githubAccess.access_token;

    const userDataRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${code}` },
    });

    if (!userDataRes.ok) {
      throw new BadRequestException('Invalid GitHub token');
    }
    const githubData = (await userDataRes.json()) as GithubUserResponse;

    // handling email not returned from the first request
    let email = githubData.email ?? null;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${code}` },
      });

      if (!emailsRes.ok) {
        throw new BadRequestException('Failed to fetch GitHub emails');
      }

      const emails = (await emailsRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;

      const primaryVerified = emails.find((e) => e.primary && e.verified);

      if (!primaryVerified) {
        throw new BadRequestException('No verified primary email found for this GitHub account');
      }

      email = primaryVerified.email;
    }

    return {
      id: String(githubData.id),
      email,
      name: githubData.name,
      avatar_url: githubData.avatar_url,
      provider: 'github',
    };
  }
}
