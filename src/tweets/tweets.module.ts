import { Module } from '@nestjs/common';
import { TweetsService } from './tweets.service';
import { TweetsController } from './tweets.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { TweetsRepository } from './tweets.repository';
import { UsersModule } from 'src/users/users.module';

@Module({
  providers: [TweetsService, PrismaService, TweetsRepository],
  controllers: [TweetsController],
  exports: [TweetsService],
  imports: [UsersModule],
})
export class TweetsModule {}
