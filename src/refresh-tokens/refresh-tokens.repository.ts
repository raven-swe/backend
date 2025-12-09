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
    const { userId, sessionId, tokenHash, expiresAt } = refreshToken;
    return prismaClient.refreshToken.create({
      data: {
        userId,
        sessionId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async getTokenByHash(hash: string) {
    return await this.prisma.refreshToken.findUnique({
      where: {
        tokenHash: hash,
      },
      include: {
        user: { select: { id: true, username: true } },
      },
    });
  }

  async updateTokenHash(tokenId: bigint, newHash: string, expiresAt: Date) {
    return await this.prisma.refreshToken.update({
      where: {
        id: tokenId,
      },
      data: {
        tokenHash: newHash,
        expiresAt,
      },
    });
  }

  async deleteTokensById(tokenId: bigint, prismaClient: Prisma.TransactionClient = this.prisma) {
    return await prismaClient.refreshToken.delete({ where: { id: tokenId } });
  }
}
