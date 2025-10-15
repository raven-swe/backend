import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor(config: ConfigService) {
    super({
      datasourceUrl: config.get('DATABASE_URL'),
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.info('Database connected');
    } catch (err) {
      console.error('Database connection error', err);
      process.exit(1);
    }
  }
}
