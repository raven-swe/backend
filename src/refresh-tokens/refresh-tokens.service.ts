import { Injectable, Logger } from '@nestjs/common';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { RefreshToken } from './interfaces';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RefreshTokensService {
  private readonly logger = new Logger(RefreshTokensService.name);

  constructor(
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly prisma: PrismaService,
  ) {}

  // service methods that take tx as a parameter for transactions are ones that will be used in a transaction by *another service*
  async createRefreshToken(refreshToken: RefreshToken, tx: Prisma.TransactionClient = this.prisma) {
    const token = await this.refreshTokensRepository.createRefreshToken(refreshToken, tx);
    this.logger.log('Refresh token created successfully for user ID: ' + refreshToken.userId);
    return token;
  }
}
