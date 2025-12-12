import { Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { plainToInstance } from 'class-transformer';
import { JwtAuthGuard } from 'src/auth/guards';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/common/interfaces';
import { CompactUserDto } from './dtos/compact-user.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post(':username/following')
  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 10,
      ttl: 60,
    },
  })
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
    const itemsDto = plainToInstance(CompactUserDto, items);
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
    const itemsDto = plainToInstance(CompactUserDto, items);
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
    const itemsDto = plainToInstance(CompactUserDto, items);
    return { items: itemsDto, pagination };
  }

  @Get(':username/relationship')
  @UseGuards(JwtAuthGuard)
  async getUserRelationship(@Param('username') username: string, @User() user: RequestUser) {
    return this.usersService.getUserRelationship(BigInt(user.id), username);
  }
  @Post(':username/notify')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async enableUserNotifications(@Param('username') username: string, @User() user: RequestUser) {
    return await this.usersService.enableUserNotifications(BigInt(user.id), username);
  }

  @Delete(':username/notify')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async disableUserNotifications(@Param('username') username: string, @User() user: RequestUser) {
    return await this.usersService.disableUserNotifications(BigInt(user.id), username);
  }
}
