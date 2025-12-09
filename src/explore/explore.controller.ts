import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards';
import { ExploreService } from './explore.service';

@Controller('explore')
export class ExploreController {
  constructor(private readonly exploreService: ExploreService) {}

  @Get('trending')
  @UseGuards(JwtAuthGuard)
  async getTrendingTabKeywords() {
    return this.exploreService.getTrendingTabKeywords();
  }

  @Get('entertainment')
  @UseGuards(JwtAuthGuard)
  async getEntertainmentKeywords() {
    return this.exploreService.getEntertainmentKeywords();
  }

  @Get('news')
  @UseGuards(JwtAuthGuard)
  async getNewsKeywords() {
    return this.exploreService.getNewsKeywords();
  }

  @Get('sports')
  @UseGuards(JwtAuthGuard)
  async getSportsKeywords() {
    return this.exploreService.getSportsKeywords();
  }
}
