import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { ProviderProfile } from '../interfaces/oAuth.interface';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor() {
    super({
      clientID: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
      callbackURL: process.env.GITHUB_CALLBACK_URL ?? '',
      scope: ['user:email'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    githubProviderProfile: Profile,
    done: (error: Error | null, user?: ProviderProfile | null) => void,
  ): void {
    const email = githubProviderProfile.emails?.[0]?.value;
    if (!email) {
      return done(new Error('Email is required from GitHub profile'), null);
    }

    const user: ProviderProfile = {
      id: githubProviderProfile.id,
      email,
      name: githubProviderProfile.displayName,
      provider: 'github',
    };

    done(null, user);
  }
}
