import { Module } from '@nestjs/common';
import { TweetsService } from './tweets.service';
import { TweetsController } from './tweets.controller';
import { TweetsRepository } from './tweets.repository';
import { UsersModule } from 'src/users/users.module';

@Module({
  providers: [TweetsService, TweetsRepository],
  controllers: [TweetsController],
  exports: [TweetsService],
  imports: [UsersModule],
})
export class TweetsModule {}
