import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor(
    config: ConfigService,
    private readonly logger: Logger,
  ) {
    super({
      datasourceUrl: config.get('DATABASE_URL'),
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
