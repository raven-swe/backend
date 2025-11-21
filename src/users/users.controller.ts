import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { plainToInstance } from 'class-transformer';
import { FollowingUserDto } from './dtos';
import { JwtAuthGuard } from 'src/auth/guards';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/common/interfaces';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post(':username/following')
  @UseGuards(JwtAuthGuard)
  async followUser(@Param('username') username: string, @User() user: RequestUser) {
    await this.usersService.followUser(BigInt(user.id), username);
    return { message: 'Followed user successfully' };
  }

  @Delete(':username/following')
  @UseGuards(JwtAuthGuard)
  async unfollowUser(@Param('username') username: string, @User() user: RequestUser) {
    await this.usersService.unfollowUser(BigInt(user.id), username);
    return { message: 'Unfollowed user successfully' };
  }

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
    @User() user: RequestUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsed = Number(limit);
    const parsedLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
    const { items, pagination } = await this.usersService.getUserFollowings(
      username,
      BigInt(user.id),
      parsedLimit,
      cursor,
    );
    const itemsDto = plainToInstance(FollowingUserDto, items);
    return { items: itemsDto, pagination };
  }

  @Get(':username/mutual')
  @UseGuards(JwtAuthGuard)
  async getUserMutualFollowers(
    @Param('username') username: string,
    @User() user: RequestUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsed = Number(limit);
    const parsedLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
    const { items, pagination } = await this.usersService.getUserMutualFollowers(
      username,
      BigInt(user.id),
      parsedLimit,
      cursor,
    );
    const itemsDto = plainToInstance(FollowingUserDto, items);
    return { items: itemsDto, pagination };
  }

  @Get(':username/followers')
  @UseGuards(JwtAuthGuard)
  async getUserFollowers(
    @Param('username') username: string,
    @User() user: RequestUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsed = Number(limit);
    const parsedLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
    const { items, pagination } = await this.usersService.getUserFollowers(
      username,
      BigInt(user.id),
      parsedLimit,
      cursor,
    );
    const itemsDto = plainToInstance(FollowingUserDto, items);
    return { items: itemsDto, pagination };
  }
}
