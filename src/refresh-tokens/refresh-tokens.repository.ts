import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RefreshToken } from './interfaces';
import { Prisma } from '@prisma/client';

@Injectable()
export class RefreshTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createRefreshToken(
    refreshToken: RefreshToken,
    prismaClient: Prisma.TransactionClient = this.prisma,
  ) {
    const { userId, deviceId, tokenHash, expiresAt } = refreshToken;
    return prismaClient.refreshToken.create({
      data: {
        userId: userId,
        deviceId: deviceId,
        tokenHash: tokenHash,
        expiresAt: expiresAt,
      },
    });
  }
}
