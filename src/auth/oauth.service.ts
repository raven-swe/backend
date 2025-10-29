import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ProviderProfile } from './types/oauth.type';
import { OAuthProviderStrategy } from './strategies/oauth.provider.strategy';
import { GithubOAuthStrategy } from './strategies/oauth.github.strategy';
import { GoogleOAuthStrategy } from './strategies/oauth.google.strategy';
import { SupportedOAuthProvider } from './constants/supported-oauth-providers';
import { ConfigService } from '@nestjs/config';
import { createValidationError } from 'src/common/utils/create-validation-error.util';
import { AuthService } from './auth.service';

@Injectable()
export class oAuthService {
  private strategies: Record<SupportedOAuthProvider, OAuthProviderStrategy>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {
    this.strategies = {
      github: new GithubOAuthStrategy(this.config),
      google: new GoogleOAuthStrategy(this.config),
    };
  }

  async handleOauthToken(
    provider: SupportedOAuthProvider,
    providerToken: string,
    deviceType: string,
    ipAddress: string,
  ) {
    const strategy = this.strategies[provider];
    if (!strategy) {
      throw new BadRequestException(
        createValidationError('provider', {
          invalidParam: `Unsupported OAuth provider: ${provider}`,
        }),
      );
    }

    const providerProfile = await strategy.validateToken(providerToken);

    return this.handleOauthProfile(providerProfile, deviceType, ipAddress);
  }

  async handleOauthProfile(
    providerProfile: ProviderProfile,
    deviceType: string,
    ipAddress: string,
  ) {
    // Check if this user already registered with this external account
    const externalAccount = await this.prisma.user_external_accounts.findUnique({
      where: {
        provider_provider_user_id: {
          provider: providerProfile.provider,
          provider_user_id: providerProfile.id,
        },
      },
      include: { user: true },
    });

    if (externalAccount) {
      return await this.authService.login(
        { username: externalAccount.user.username, id: externalAccount.user.id.toString() },
        deviceType,
        ipAddress,
      );
    } else {
      const userAccount = await this.prisma.users.findUnique({
        where: { email: providerProfile.email },
      });

      if (userAccount) {
        await this.prisma.user_external_accounts.create({
          data: {
            user_id: userAccount.id,
            provider_user_id: providerProfile.id,
            provider: providerProfile.provider,
          },
        });

        const user = {
          id: userAccount.id.toString(),
          username: userAccount.username,
        };

        return await this.authService.login(user, deviceType, ipAddress);
      } else {
        const creationToken = this.jwtService.sign({
          provider: providerProfile.provider,
          providerId: providerProfile.id,
          email: providerProfile.email,
          name: providerProfile.name,
          type: 'creation',
          avatar_url: providerProfile.avatar_url,
        });
        return {
          creationToken,
        };
      }
    }
  }

  async completeOauthRegister(
    creationToken: string,
    birthDate: string,
    deviceType: string,
    ipAddress: string,
  ) {
    let payload: {
      provider: string;
      providerId: string;
      email: string;
      name: string;
      type: string;
      avatar_url: string;
    };
    try {
      payload = this.jwtService.verify(creationToken);

      if (payload.type !== 'creation') {
        throw new BadRequestException(
          createValidationError('creationToken', {
            invalidToken: 'The provided token is not a valid account creation token.',
          }),
        );
      }
    } catch (err: unknown) {
      let reason = 'Invalid or malformed token. Please try again.';

      if (err instanceof Error && err.name === 'TokenExpiredError') {
        reason = 'This creation token has expired. Please restart the registration process.';
      }

      throw new BadRequestException(
        createValidationError('creationToken', {
          invalidToken: reason,
        }),
      );
    }

    console.log(payload);

    const user = await this.prisma.users.create({
      data: {
        email: payload.email,
        username: payload.email, // TODO generate username correctly (suggestions)
        birthdate: new Date(birthDate),
        profile: {
          create: { display_name: payload.name, avatar_url: payload.avatar_url },
        },
        user_external_accounts: {
          create: {
            provider: payload.provider,
            provider_user_id: payload.providerId,
          },
        },
      },
    });

    return await this.authService.login(
      { id: user.id.toString(), username: user.username },
      deviceType,
      ipAddress,
    );
  }
}
