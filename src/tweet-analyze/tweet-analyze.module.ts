import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TweetAnalyzeService } from './tweet-analyze.service';
import { TweetAnalyzeRepository } from './tweet-analyze.repository';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [HttpModule, PrismaModule, RedisModule],
  providers: [TweetAnalyzeService, TweetAnalyzeRepository],
  exports: [TweetAnalyzeService],
})
export class TweetAnalyzeModule {}
