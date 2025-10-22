import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RedisModule } from './redis/redis.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { EmailModule } from './email/email.module';
import { RecaptchaModule } from './recaptcha/recaptcha.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { RefreshTokensModule } from './refresh-tokens/refresh-tokens.module';
import { HttpExceptionFilter } from './common/filters/http-response.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';


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
    DevicesModule,
    RedisModule,
    PrismaModule,
    EmailModule,
    RecaptchaModule,
    RefreshTokensModule,
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
