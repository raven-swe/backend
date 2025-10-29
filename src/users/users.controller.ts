import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/auth/types/user.type';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':username/profile')
  // TODO: This should be optional guard (if logged in, provide more details)
  @UseGuards(JwtAuthGuard)
  async getUserProfile(@Param('username') username: string, @User() user: RequestUser) {
    const currentUserId = BigInt(user.id);
    return this.usersService.getUserProfile(username, currentUserId);
  }
}
