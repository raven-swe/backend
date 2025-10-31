import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// TODO in refactor: integrate with other auth repositories to have a unified auth repository file(hope to see it created one day)

@Injectable()
export class OAuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findExternalAccountWithUser(provider: string, providerUserId: string) {
    return await this.prisma.userExternalAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId: providerUserId,
        },
      },
      include: { user: true },
    });
  }

  async findUserByEmail(email: string) {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findUserByEmailWithExternalAccounts(email: string) {
    return await this.prisma.user.findUnique({
      where: { email },
      include: {
        userExternalAccounts: true,
      },
    });
  }

  async createExternalAccount(userId: bigint, provider: string, providerUserId: string) {
    return await this.prisma.userExternalAccount.create({
      data: {
        userId: userId,
        providerUserId: providerUserId,
        provider,
      },
    });
  }

  async createUserWithProfileAndExternalAccount(
    email: string,
    username: string,
    birthdate: Date,
    displayName: string,
    avatarUrl: string,
    provider: string,
    providerId: string,
  ) {
    return await this.prisma.user.create({
      data: {
        email,
        username,
        birthdate,
        profile: {
          create: {
            displayName: displayName,
            avatarUrl: avatarUrl,
          },
        },
        userExternalAccounts: {
          create: {
            provider,
            providerUserId: providerId,
          },
        },
      },
    });
  }

  async updateUserBirthdate(userId: bigint, birthdate: Date) {
    return await this.prisma.user.update({
      where: { id: userId },
      data: { birthdate },
    });
  }
}
