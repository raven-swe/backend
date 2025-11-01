import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/auth/types/user.type';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { plainToInstance } from 'class-transformer';
import { FollowingUserDto } from './dtos/following-user.dto';
import { CursorPagination } from 'src/common/interfaces/response.interface';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':username/profile')

  // TODO: This should be optional guard (if logged in, provide more details (just the relations))
  @UseGuards(JwtAuthGuard)
  async getUserProfile(@Param('username') username: string, @User() user: RequestUser) {
    const currentUserId = BigInt(user.id);

    return this.usersService.getUserProfile(username, currentUserId);
  }

  @Get(':username/following')
  @UseGuards(JwtAuthGuard)
  async getUserFollowings(
    @Param('username') username: string,
    @Query('limit') limit = 10,
    @Query('cursor') cursor?: string,
  ) {
    const result = await this.usersService.getUserFollowings(username, limit, cursor);
    const items = plainToInstance(FollowingUserDto, result, { excludeExtraneousValues: true });
    return { items };
  }

  @Get(':username/mutual')
  @UseGuards(JwtAuthGuard)
  async getUserMutualFollowers(
    @Param('username') username: string,
    @Query('limit') limit = 10,
    @User('id') userId: bigint,
    @Query('cursor') cursor?: string,
  ) {
    const result = await this.usersService.getUserMutualFollowers(username, userId, limit, cursor);
    const items = plainToInstance(FollowingUserDto, result, { excludeExtraneousValues: true });
    return { items };
  }

  @Get(':username/followers')
  @UseGuards(JwtAuthGuard)
  async getUserFollowers(
    @Param('username') username: string,
    @Query('limit') limit = 10,
    @Query('cursor') cursor?: string,
  ) {
    const result = await this.usersService.getUserFollowers(username, limit, cursor);

    // const items = plainToInstance(FollowingUserDto, result, { excludeExtraneousValues: true });
    const pagination: CursorPagination = { hasNextPage: false, cursor: 'd', nextCursor: 'dfd' };
    return { items: result, pagination };
  }
}
