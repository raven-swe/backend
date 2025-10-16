import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RedisModule } from './redis/redis.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HttpExceptionFilter } from './common/filters/http-response.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
    AuthModule,
    UsersModule,
    RedisModule,
    PrismaModule,
    EmailModule,
    RecaptchaModule,
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
