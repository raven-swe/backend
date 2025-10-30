import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient {
  private readonly logger = new Logger(PrismaService.name);
  constructor() {
    super({
      datasourceUrl: process.env.DATABASE_URL,
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connected');
    } catch (err) {
      this.logger.error(
        'Database connection error',
        err instanceof Error ? err.stack : String(err),
      );
      process.exit(1);
    }
  }
}
