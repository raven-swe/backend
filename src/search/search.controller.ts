import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchUsernameQueryDto } from './dtos';
import { JwtAuthGuard } from 'src/auth/guards';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/common/interfaces';
import { SearchService } from './search.service';
import { SearchTweetsQueryDto } from './dtos/search-tweets-query.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}
  @Get('users')
  @UseGuards(JwtAuthGuard)
  async getTopUsers(
    @User() user: RequestUser,
    @Query() searchUsernameQueryDto: SearchUsernameQueryDto,
  ) {
    const userId = BigInt(user.id);
    return this.searchService.getMatchingUsers(userId, searchUsernameQueryDto.query);
  }

  @Get('tweets')
  @UseGuards(JwtAuthGuard)
  async searchTweets(
    @User() user: RequestUser,
    @Query() searchTweetsQueryDto: SearchTweetsQueryDto,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const currentUserId = BigInt(user.id);
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.searchService.searchTweets(
      currentUserId,
      searchTweetsQueryDto,
      parsedLimit,
      cursor,
    );
  }
}
