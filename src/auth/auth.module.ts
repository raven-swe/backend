import { Logger, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from 'src/users/users.module';
import { RecaptchaModule } from 'src/recaptcha/recaptcha.module';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    UsersModule,
    RecaptchaModule,
    JwtModule,
    BullModule.registerQueue({
      name: 'email',
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, Logger],
})
export class AuthModule {}
