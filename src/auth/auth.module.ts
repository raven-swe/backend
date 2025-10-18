import { Logger, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from 'src/users/users.module';
import { RecaptchaModule } from 'src/recaptcha/recaptcha.module';
import { JwtModule } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { BullModule } from '@nestjs/bullmq';
import { DevicesModule } from 'src/devices/devices.module';
@Module({
  imports: [
    UsersModule,
    RecaptchaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default_secret_key',
      signOptions: { expiresIn: '30m' },
    }),
    JwtModule,
    BullModule.registerQueue({
      name: 'email',
    }),
    DevicesModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, Logger, UsersService],
})
export class AuthModule {}
