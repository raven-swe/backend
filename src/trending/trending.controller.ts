import { Body, Controller, Post } from '@nestjs/common';
import { TrendingService } from './trending.service';
import { UpdateTrendScoresDto } from './dtos';

@Controller('trending')
export class TrendingController {
  constructor(private readonly trendingService: TrendingService) {}
  // For testing purposes only
  @Post('update-scores')
  async updateTrendScores(@Body() updateTrendScoresDto: UpdateTrendScoresDto) {
    return this.trendingService.updateTrendScores(updateTrendScoresDto);
  }
}
