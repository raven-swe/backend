import { Module } from '@nestjs/common';
import { ExploreController } from './explore.controller';
import { ExploreService } from './explore.service';
import { ExploreRepository } from './explore.repository';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ExploreController],
  providers: [ExploreService, ExploreRepository],
  exports: [ExploreService],
})
export class ExploreModule {}
