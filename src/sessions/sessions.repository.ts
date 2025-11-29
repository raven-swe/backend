import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { Session } from './interfaces/session.interface';

@Injectable()
export class SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(session: Session, prismaClient: Prisma.TransactionClient = this.prisma) {
    const { userId, ipAddress, userAgent } = session;
    return prismaClient.session.create({
      data: {
        userId,
        ipAddress,
        userAgent,
      },
    });
  }
}
