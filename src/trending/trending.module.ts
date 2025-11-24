import { Module } from '@nestjs/common';
import { TrendingService } from './trending.service';
import { TrendingController } from './trending.controller';
import { TrendingRepository } from './trending.repository';

@Module({
  providers: [TrendingService, TrendingRepository],
  controllers: [TrendingController],
  exports: [TrendingService],
})
export class TrendingModule {}
