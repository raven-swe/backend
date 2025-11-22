import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { OauthModule } from './auth/oauth.module';
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
import { DevicesModule } from './devices/devices.module';
import { RATE_LIMIT } from './common/constants/rate-limit.constants';
import { MediaModule } from './media/media.module';
import { TestingModule } from './testing/testing.module';
import { TweetsModule } from './tweets/tweets.module';
import { HealthController } from './health/health.controller';
import { shouldSkipRateLimit } from './common/utils/should-skip-rate-limit';
import { TrendingModule } from './trending/trending.module';
import { ContentParsingModule } from './content-parsing/content-parsing.module';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { LoggerModule } from './logger/logger.module';
import { AppLogger } from './logger/logger.service';
import { ConversationsModule } from './conversations/conversations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: RATE_LIMIT.GLOBAL.TTL,
          limit: RATE_LIMIT.GLOBAL.LIMIT,
        },
      ],
      skipIf: shouldSkipRateLimit,
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
    DevicesModule,
    RedisModule,
    PrismaModule,
    EmailModule,
    RecaptchaModule,
    RefreshTokensModule,
    DevicesModule,
    MediaModule,
    TweetsModule,
    ConversationsModule,
    ...(process.env.NODE_ENV === 'testing' ? [TestingModule] : []),
    TrendingModule,
    ContentParsingModule,
    LoggerModule,
  ],
  controllers: [HealthController],
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
    HttpExceptionFilter,
    AppLogger,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
