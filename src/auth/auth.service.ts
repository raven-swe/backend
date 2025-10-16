import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { ProviderProfile } from './interfaces/oAuth.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async handlePassportOauth(providerProfile: ProviderProfile) {
    // Check if user exists in DB
    // TODO check with email not provider_id (3 cases)
    const externalAccount = await this.prisma.user_external_accounts.findUnique({
      where: {
        provider_provider_user_id: {
          provider: providerProfile.provider,
          provider_user_id: providerProfile.id,
        },
      },
      include: { user: true },
    });

    const user = externalAccount?.user;

    if (user) {
      // If user exists, return access and refresh tokens
      // TODO set expirations
      // TODO make unified token generation function
      const accessToken = this.jwtService.sign({ userId: user.id, username: user.username });
      const refreshToken = crypto.randomBytes(64).toString('hex');

      return {
        success: true,
        data: { accessToken, refreshToken },
      };
    } else {
      // If not, return creationToken
      const creationToken = this.jwtService.sign({
        provider: providerProfile.provider,
        providerId: providerProfile.id,
        email: providerProfile.email,
        name: providerProfile.name,
        type: 'creation',
      });
      return {
        success: true,
        data: { creationToken },
      };
    }
  }

  async completeOauthRegister(creationToken: string, birthDate: string) {
    let payload: {
      provider: string;
      providerId: string;
      email: string;
      name: string;
      type: string;
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
          create: { display_name: payload.name },
        },
        user_external_accounts: {
          create: {
            provider: payload.provider,
            provider_user_id: payload.providerId,
          },
        },
      },
    });

    // TODO set expirations
    const accessToken = this.jwtService.sign({ userId: user.id, username: user.username });
    const refreshToken = crypto.randomBytes(64).toString('hex');

    return {
      success: true,
      data: { accessToken, refreshToken },
    };
  }
}
