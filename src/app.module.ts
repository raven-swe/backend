import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { OauthModule } from './auth/oauth.module';
import { UsersModule } from './users/users.module';
import { RedisModule } from './redis/redis.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { RefreshTokensModule } from './refresh-tokens/refresh-tokens.module';
import { DevicesModule } from './device/device.module';
import { HttpExceptionFilter } from './common/filters/http-response.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { BullModule } from '@nestjs/bullmq';
import { EmailModule } from './email/email.module';
import { RecaptchaModule } from './recaptcha/recaptcha.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60_000,
          limit: 60, // 60 requests per minute
        },
      ],
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
      },
    }),
    AuthModule,
    OauthModule,
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

    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
