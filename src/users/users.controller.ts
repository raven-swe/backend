import { Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
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
}
