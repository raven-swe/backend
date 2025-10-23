import { Controller, Get, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':username/profile')
  // TODO: @UseGuards(OptionalJwtAuthGuard) --
  async getUserProfile(
    @Param('username') username: string,
    // TODO: @Request() request
  ) {
    // const currentUserId = request.user?.id;
    const currentUserId = BigInt(1);
    return this.usersService.getUserProfile(username, currentUserId);
  }
}
