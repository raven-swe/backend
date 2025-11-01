import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/auth/types/user.type';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { plainToInstance } from 'class-transformer';
import { FollowingUserDto } from './dtos/following-user.dto';

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
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsed = Number(limit);
    const parsedLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
    const { items, pagination } = await this.usersService.getUserFollowings(
      username,
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
    @Query('limit') limit: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsed = Number(limit);
    const parsedLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
    const { items, pagination } = await this.usersService.getUserFollowers(
      username,
      parsedLimit,
      cursor,
    );
    const itemsDto = plainToInstance(FollowingUserDto, items);
    return { items: itemsDto, pagination };
  }
}
