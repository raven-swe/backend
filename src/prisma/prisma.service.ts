import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient {
  static readonly DATABASE_URL = `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;
  constructor(
    config: ConfigService,
    private readonly logger: Logger,
  ) {
    super({
      datasourceUrl: PrismaService.DATABASE_URL,
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
