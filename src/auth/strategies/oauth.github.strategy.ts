import { BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthProviderStrategy } from './oauth.provider.strategy';
import { ProviderProfile } from '../types/oauth.type';
import { createValidationError } from 'src/common/utils/create-validation-error.util';

interface GithubUserResponse {
  id: number | string;
  email: string;
  name: string;
  login: string;
  avatar_url: string;
}

export class GithubOAuthStrategy implements OAuthProviderStrategy {
  constructor(private readonly config: ConfigService) {}

  async validateToken(providerToken: string, clientType: string): Promise<ProviderProfile> {
    const redirectUri =
      clientType === 'mobile'
        ? this.config.get<string>('GITHUB_REDIRECT_URI')!
        : this.config.get<string>('GITHUB_REDIRECT_URI')!;

    Logger.log(clientType, 'Client of GithubStrategy');
    Logger.log(redirectUri, 'GithubOauthStrategy');

    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.get<string>('GITHUB_CLIENT_ID')!,
        client_secret: this.config.get<string>('GITHUB_CLIENT_SECRET')!,
        code: providerToken,
        redirect_uri: redirectUri,
      }),
    });

    if (!res.ok) {
      throw new BadRequestException(
        createValidationError('providerToken', {
          invalidValue:
            'The GitHub authorization token is invalid or expired. Please try logging in again.',
        }),
      );
    }

    const githubAccess = (await res.json()) as { access_token: string };

    if (!githubAccess.access_token)
      throw new BadRequestException(
        'Failed to obtain access token from GitHub, can be an expired code.',
      );

    const code = githubAccess.access_token;

    const userDataRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${code}` },
    });

    if (!userDataRes.ok)
      throw new BadRequestException(
        'Unable to retrieve your GitHub profile. Please check your GitHub account permissions.',
      );

    const githubData = (await userDataRes.json()) as GithubUserResponse;

    // handling email not returned from the first request
    let email = githubData.email ?? null;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${code}` },
      });

      if (!emailsRes.ok) {
        throw new UnauthorizedException(
          'Cannot find email, Please check your GitHub account permissions.',
        );
      }

      const emails = (await emailsRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;

      const primaryVerified = emails.find((e) => e.primary && e.verified);

      if (!primaryVerified) {
        throw new UnauthorizedException(
          'No verified primary email found for this GitHub account, please verify your email on GitHub and try again.',
        );
      }

      email = primaryVerified.email;
    }
    let name = githubData.name;
    if (!name) name = email.split('@')[0]; // handle missing name from github

    return {
      id: String(githubData.id),
      email,
      name,
      avatar_url: githubData.avatar_url || null,
      provider: 'github',
    };
  }
}
