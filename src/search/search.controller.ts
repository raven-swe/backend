import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchUsernameQueryDto } from './dtos';
import { JwtAuthGuard } from 'src/auth/guards';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/common/interfaces';
import { SearchService } from './search.service';

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
}
