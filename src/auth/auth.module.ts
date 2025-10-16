import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { OauthController } from './oauth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from 'src/users/users.module';
import { GithubStrategy } from './strategies/oauth.github.strategy';

@Module({
  imports: [UsersModule],
  controllers: [AuthController, OauthController],
  providers: [AuthService, GithubStrategy],
})
export class AuthModule {}
