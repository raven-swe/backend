import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RefreshToken } from './interfaces/refresh-token.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class RefreshTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createRefreshToken(
    refreshToken: RefreshToken,
    prismaClient: Prisma.TransactionClient = this.prisma,
  ) {
    const { userId, deviceId, tokenHash, expiresAt } = refreshToken;
    return prismaClient.refresh_tokens.create({
      data: {
        user_id: userId,
        device_id: deviceId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });
  }
}
