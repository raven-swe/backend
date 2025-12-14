import { Module } from '@nestjs/common';
import { ExploreController } from './explore.controller';
import { ExploreService } from './explore.service';
import { ExploreRepository } from './explore.repository';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TweetsModule } from 'src/tweets/tweets.module';

@Module({
  imports: [PrismaModule, TweetsModule],
  controllers: [ExploreController],
  providers: [ExploreService, ExploreRepository],
  exports: [ExploreService],
})
export class ExploreModule {}
