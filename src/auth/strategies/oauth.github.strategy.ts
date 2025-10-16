import { BadRequestException } from '@nestjs/common';
import { OAuthProviderStrategy } from './oauth.provider.strategy';
import { ProviderProfile } from '../interfaces/oauth.interface';

interface GithubUserResponse {
  id: number | string;
  email: string;
  name: string;
  login: string;
}

export class GithubOAuthStrategy implements OAuthProviderStrategy {
  async validateToken(providerTokenId: string): Promise<ProviderProfile> {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${providerTokenId}` },
    });
    if (!res.ok) {
      throw new BadRequestException('Invalid GitHub token');
    }
    const githubData = (await res.json()) as GithubUserResponse;

    // handling email not returned from the first request
    let email = githubData.email ?? null;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${providerTokenId}` },
      });

      if (!emailsRes.ok) {
        throw new BadRequestException('Failed to fetch GitHub emails');
      }

      const emails: Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }> = await emailsRes.json();

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
      provider: 'github',
    };
  }
}
