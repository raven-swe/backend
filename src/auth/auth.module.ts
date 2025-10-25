import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from 'src/users/users.module';
import { RecaptchaModule } from 'src/recaptcha/recaptcha.module';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { RefreshTokensModule } from 'src/refresh-tokens/refresh-tokens.module';
import { DevicesModule } from 'src/device/device.module';
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
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
