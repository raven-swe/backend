import { Module } from '@nestjs/common';
import { TrendingService } from './trending.service';
import { TrendingController } from './trending.controller';

@Module({
  providers: [TrendingService],
  controllers: [TrendingController]
})
export class TrendingModule {}
