import { BadRequestException } from '@nestjs/common';
import { OAuthProviderStrategy } from './oauth.provider.strategy';
import { ProviderProfile } from '../interfaces/oauth.interface';

export class GithubOAuthStrategy implements OAuthProviderStrategy {
  async validateToken(providerTokenId: string): Promise<ProviderProfile> {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${providerTokenId}` },
    });
    if (!res.ok) {
      throw new BadRequestException('Invalid GitHub token');
    }
    const githubData = await res.json();

    // TODO search more about the emails and name if always exist(MUST)
    // let email = githubData.email ?? null;
    // if (!email) {
    //   const emailsRes = await fetch('https://api.github.com/user/emails', {
    //     headers: { Authorization: `Bearer ${providerTokenId}` },
    //   });
    //   if (emailsRes.ok) {
    //     const emails = await emailsRes.json();
    //     const primary = emails.find((e: any) => e.primary) || emails[0];
    //     email = primary?.email ?? null;
    //   }
    // }

    return {
      id: String(githubData.id),
      email: githubData.email,
      name: githubData.name,
      provider: 'github',
    };
  }
}
