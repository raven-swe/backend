import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [AuthModule, UsersModule, RedisModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
