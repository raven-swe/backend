import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RequestUser } from './types/user.type';
import { hash } from 'bcrypt';
import crypto from 'node:crypto';
import { ProviderProfile } from './types/oauth.type';
import { OAuthProviderStrategy } from './strategies/oauth.provider.strategy';
import { GithubOAuthStrategy } from './strategies/oauth.github.strategy';
import { GoogleOAuthStrategy } from './strategies/oauth.google.strategy';
import { SupportedOAuthProvider } from './constants/supported-oauth-providers';
import { ConfigService } from '@nestjs/config';
import useragent from 'useragent';

@Injectable()
export class oAuthService {
  private strategies: Record<SupportedOAuthProvider, OAuthProviderStrategy>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    this.strategies = {
      github: new GithubOAuthStrategy(this.config),
      google: new GoogleOAuthStrategy(this.config),
    };
  }

  async handleOauthToken(
    provider: SupportedOAuthProvider,
    providerTokenId: string,
    agent: useragent.Agent,
  ) {
    const strategy = this.strategies[provider];
    if (!strategy) {
      throw new BadRequestException(`Provider ${provider} is not supported`);
    }

    const providerProfile = await strategy.validateToken(providerTokenId);

    return this.handleOauthProfile(providerProfile, agent);
  }

  async login(user: RequestUser, agent: useragent.Agent) {
    const accessToken = this.jwtService.sign(user);
    const refreshTokenExpiresIn = parseInt(
      this.config.get<string>('REFRESH_TOKEN_EXPIRES_IN_DAYS') || '30',
      10,
    );
    const { refreshToken, hashedRefreshToken, expiresAt } =
      await this.generateRefreshTokenWithExpiry(refreshTokenExpiresIn);

    await this.prisma.$transaction(async (tx) => {
      const user_device = await tx.user_devices.create({
        data: {
          user_id: BigInt(user.id),
          device_type: agent.toString(),
        },
      });

      await tx.refresh_tokens.create({
        data: {
          user_id: BigInt(user.id),
          device_id: user_device.id,
          token_hash: hashedRefreshToken,
          expires_at: expiresAt,
        },
      });
    });
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private async generateRefreshTokenWithExpiry(expiryInDays: number) {
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const hashedRefreshToken = await hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryInDays);
    return { refreshToken, hashedRefreshToken, expiresAt };
  }

  async handleOauthProfile(providerProfile: ProviderProfile, agent: useragent.Agent) {
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
      return await this.login(
        { username: externalAccount.user.username, id: externalAccount.user.id.toString() },
        agent,
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

        return await this.login(user, agent);
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
          success: true,
          data: { creationToken },
        };
      }
    }
  }

  async completeOauthRegister(
    creationToken: string,
    birthDate: string,
    useragent: useragent.Agent,
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
      if (payload.type !== 'creation') throw new Error('Invalid creation token');
    } catch {
      throw new BadRequestException('Invalid creation token');
    }

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

    // DEBUG
    console.info(user);

    // TODO set expirations
    // TODO make unified token generation function
    return await this.login({ id: user.id.toString(), username: user.username }, useragent);
  }
}
