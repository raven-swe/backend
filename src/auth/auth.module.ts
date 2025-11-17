import { Logger, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from 'src/users/users.module';
import { RecaptchaModule } from 'src/recaptcha/recaptcha.module';
import { BullModule } from '@nestjs/bullmq';
import { DevicesModule } from 'src/devices/devices.module';
import { RefreshTokensModule } from 'src/refresh-tokens/refresh-tokens.module';
import { LocalStrategy } from './strategies/local.strategy';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy';
import { OnboardingController } from './onboarding.controller';

@Module({
  imports: [
    UsersModule,
    RecaptchaModule,
    RefreshTokensModule,
    DevicesModule,
    BullModule.registerQueue({
      name: 'email',
    }),
    PassportModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable not set!');
        }
        return {
          secret: secret,
          signOptions: {
            expiresIn: configService.get<number>('JWT_EXPIRES_IN_SECONDS') || 15 * 60, // 15 mins
          },
        };
      },
    }),
  ],
  controllers: [AuthController, OnboardingController],
  providers: [AuthService, LocalStrategy, JwtStrategy, Logger],
  exports: [AuthService],
})
export class AuthModule {}
