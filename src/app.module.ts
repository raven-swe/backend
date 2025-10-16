import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RedisModule } from './redis/redis.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { EmailModule } from './email/email.module';
import { RecaptchaModule } from './recaptcha/recaptcha.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UsersModule,
    RedisModule,
    PrismaModule,
    EmailModule,
    RecaptchaModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
