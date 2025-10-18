import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RedisModule } from './redis/redis.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { EmailModule } from './email/email.module';
import { RecaptchaModule } from './recaptcha/recaptcha.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { RefreshTokensModule } from './refresh-tokens/refresh-tokens.module';
import { DevicesModule } from './devices/devices.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60_000,
          limit: 10, // 10 requests per minute
        },
      ],
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
      },
    }),
    AuthModule,
    UsersModule,
    RedisModule,
    PrismaModule,
    EmailModule,
    RecaptchaModule,
    RefreshTokensModule,
    DevicesModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
