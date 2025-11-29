import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { SessionsRepository } from './sessions.repository';
import { Session } from './interfaces/session.interface';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly sessionRepository: SessionsRepository,
    private readonly prisma: PrismaService,
  ) {}
  async createSession(session: Session, tx: Prisma.TransactionClient = this.prisma) {
    const newSession = await this.sessionRepository.createSession(session, tx);
    this.logger.log('Session created successfully for user ID: ' + session.userId);
    return newSession;
  }

  async deleteSessionById(sessionId: bigint, tx: Prisma.TransactionClient = this.prisma) {
    return await this.sessionRepository.deleteSessionById(sessionId, tx);
  }
}
