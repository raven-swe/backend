import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchUsernameQueryDto } from './dtos';
import { JwtAuthGuard } from 'src/auth/guards';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/common/interfaces';
import { SearchService } from './search.service';
import { SearchTweetsQueryDto } from './dtos/search-tweets-query.dto';
import { ParseBooleanPipe } from 'src/common/pipes/parse-boolean.pipe';
import { TrendingService } from 'src/trending/trending.service';
import { SearchUsersQueryDto } from './dtos/search-users-query.dto';
@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly trendingService: TrendingService,
  ) {}
  @Get('tweets')
  @UseGuards(JwtAuthGuard)
  async searchTweets(
    @User() user: RequestUser,
    @Query() searchTweetsQueryDto: SearchTweetsQueryDto,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('excludeMutedAndBlocked', ParseBooleanPipe) excludeMutedAndBlocked?: boolean,
  ) {
    const currentUserId = BigInt(user.id);
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    searchTweetsQueryDto.excludeMutedAndBlocked = excludeMutedAndBlocked;
    return this.searchService.searchTweets(
      currentUserId,
      searchTweetsQueryDto,
      parsedLimit,
      cursor,
    );
  }

  @Get('hashtags/top')
  @UseGuards(JwtAuthGuard)
  async getTopHashtags(@Query('query') query: string) {
    return this.trendingService.getTrendingHashtags(query, 3);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  async searchUsers(
    @User() user: RequestUser,
    @Query() searchUsersQueryDto: SearchUsersQueryDto,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('excludeMutedAndBlocked', ParseBooleanPipe) excludeMutedAndBlocked?: boolean,
  ) {
    const currentUserId = BigInt(user.id);
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    searchUsersQueryDto.excludeMutedAndBlocked = excludeMutedAndBlocked;
    return this.searchService.searchUsers(currentUserId, searchUsersQueryDto, parsedLimit, cursor);
  }
}
