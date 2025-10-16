import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { OauthController } from './oauth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from 'src/users/users.module';
import { RecaptchaModule } from 'src/recaptcha/recaptcha.module';
import { BullModule } from '@nestjs/bullmq';
import { RefreshTokensModule } from 'src/refresh-tokens/refresh-tokens.module';
import { DevicesModule } from 'src/device/device.module';
import { GithubStrategy } from './strategies/oauth.github.strategy';
@Module({
  imports: [
    UsersModule,
    RecaptchaModule,
    RefreshTokensModule,
    DevicesModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default_secret_key',
      signOptions: { expiresIn: '30m' },
    }),
    JwtModule,
    BullModule.registerQueue({
      name: 'email',
    }),
  ],
  controllers: [AuthController, OauthController],
  providers: [AuthService],
})
export class AuthModule {}
