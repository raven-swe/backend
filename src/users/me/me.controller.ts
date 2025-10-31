import { Body, Controller, Delete, Param, Post, Put, UseGuards } from '@nestjs/common';
import { UsersService } from '../users.service';
import { ChangePasswordBasicDto } from '../dtos/change-password-basic.dto';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/auth/types';
import { RATE_LIMIT } from 'src/common/constants/rate-limit.constants';

@Controller('me')
export class MeController {
  constructor(private readonly usersService: UsersService) {}

  @Put('password')
  @Throttle({
    default: {
      limit: RATE_LIMIT.PASSWORD_CHANGE.LIMIT,
      ttl: RATE_LIMIT.PASSWORD_CHANGE.WINDOW_MS,
    },
  })
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Body() changePasswordDto: ChangePasswordBasicDto,
    @User() user: RequestUser,
  ) {
    const userIdBigInt = BigInt(user.id);
    return this.usersService.changePassword(userIdBigInt, changePasswordDto);
  }

  @Post('blocks/:username')
  @UseGuards(JwtAuthGuard)
  async blockUser(@User() user: RequestUser, @Param('username') username: string) {
    const userIdBigInt = BigInt(user.id);
    return await this.usersService.blockUser(userIdBigInt, username);
  }

  @Delete('blocks/:username')
  @UseGuards(JwtAuthGuard)
  async unblockUser(@User() user: RequestUser, @Param('username') username: string) {
    const userIdBigInt = BigInt(user.id);
    return await this.usersService.unblockUser(userIdBigInt, username);
  }
}
