import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

// TODO in refactor: integrate with other auth repositories to have a unified auth repository file(hope to see it created one day)

@Injectable()
export class OAuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findExternalAccountWithUser(provider: string, providerUserId: string) {
    return await this.prisma.user_external_accounts.findUnique({
      where: {
        provider_provider_user_id: {
          provider,
          provider_user_id: providerUserId,
        },
      },
      include: { user: true },
    });
  }

  async findUserByEmail(email: string) {
    return await this.prisma.users.findUnique({
      where: { email },
    });
  }

  async findUserByEmailWithExternalAccounts(email: string) {
    return await this.prisma.users.findUnique({
      where: { email },
      include: {
        user_external_accounts: true,
      },
    });
  }

  async createExternalAccount(
    userId: bigint,
    provider: string,
    providerUserId: string,
    prismaClient: Prisma.TransactionClient = this.prisma,
  ) {
    return await prismaClient.user_external_accounts.create({
      data: {
        user_id: userId,
        provider_user_id: providerUserId,
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
    return await this.prisma.users.create({
      data: {
        email,
        username,
        birthdate,
        profile: {
          create: {
            display_name: displayName,
            avatar_url: avatarUrl,
          },
        },
        user_external_accounts: {
          create: {
            provider,
            provider_user_id: providerId,
          },
        },
      },
    });
  }

  async updateUserBirthdate(userId: bigint, birthdate: Date) {
    return await this.prisma.users.update({
      where: { id: userId },
      data: { birthdate },
    });
  }
}
