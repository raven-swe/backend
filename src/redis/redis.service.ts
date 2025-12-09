import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService {
  private readonly redis: Redis;
  private readonly logger = new Logger(RedisService.name);

  private readonly SAFE_INCR_SCRIPT = `
            local key = KEYS[1]
            local ttl = tonumber(ARGV[1])
            
            if redis.call("EXISTS", key) == 1 then
              local newval = redis.call("INCR", key)
              redis.call("EXPIRE", key, ttl)
              return newval
            end
            return nil`;

  private readonly SAFE_DECR_SCRIPT = `
            local key = KEYS[1]
            local ttl = tonumber(ARGV[1])
            
            if redis.call("EXISTS", key) == 1 then
              local newval = redis.call("DECR", key)
              if newval < 0 then
                redis.call("SET", key, 0)
                redis.call("EXPIRE", key, ttl)
                return 0
              else
                redis.call("EXPIRE", key, ttl)
                return newval
              end
            end
            return nil`;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.redis.on('error', (err) => {
      this.logger.error('Redis connection error', err);
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  getClient(): Redis {
    return this.redis;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.redis.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async del(key: string): Promise<number> {
    return this.redis.del(key);
  }

  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<number> {
    return this.redis.expire(key, ttlSeconds);
  }
  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  async safeIncr(key: string, ttlSeconds: number): Promise<void> {
    await this.redis.eval(this.SAFE_INCR_SCRIPT, 1, key, ttlSeconds);
  }

  async safeDecr(key: string, ttlSeconds: number): Promise<void> {
    await this.redis.eval(this.SAFE_DECR_SCRIPT, 1, key, ttlSeconds);
  }
}
