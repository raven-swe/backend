import { Module } from '@nestjs/common';
import { TweetsService } from './tweets.service';
import { TweetsController } from './tweets.controller';
import { UsersModule } from 'src/users/users.module';
import { TrendingModule } from 'src/trending/trending.module';
import { TweetsRepository } from './tweets.repository';

@Module({
  imports: [UsersModule, TrendingModule],
  providers: [TweetsService, TweetsRepository],
  controllers: [TweetsController],
})
export class TweetsModule {}
