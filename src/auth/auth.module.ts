import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { OauthController } from './oauth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    UsersModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'raven',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController, OauthController],
  providers: [AuthService],
})
export class AuthModule {}
