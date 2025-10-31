import { Controller, Delete, Param, Post, UseGuards, Get } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/auth/types';

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
}
