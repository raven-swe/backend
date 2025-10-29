import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OauthController } from './oauth.controller';
import { oAuthService } from './oauth.service';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from 'src/users/users.module';
import { AuthModule } from './auth.module';
import { OAuthRepository } from './oauth.repository';

@Module({
  imports: [
    UsersModule,
    ConfigModule,
    AuthModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'raven',
        signOptions: { expiresIn: '1h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [OauthController],
  providers: [oAuthService, OAuthRepository],
})
export class OauthModule {}
