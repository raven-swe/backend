import { Global, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

@Global()
@Injectable()
export class RedisService {
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });
  }

  onModuleInit() {
    this.redis.on('connect', () => {
      console.info('Connected to Redis');
    });

    this.redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  getClient(): Redis {
    return this.redis;
  }
}
