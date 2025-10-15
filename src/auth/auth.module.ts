import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from 'src/users/users.module';
import { RecaptchaModule } from 'src/recaptcha/recaptcha.module';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { RefreshTokensModule } from 'src/refresh-tokens/refresh-tokens.module';
import { DevicesModule } from 'src/device/device.module';
import { LocalStrategy } from './local.strategy';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

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
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy],
})
export class AuthModule {}
