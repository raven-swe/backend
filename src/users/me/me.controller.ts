import { Body, Controller, Put, UseGuards } from '@nestjs/common';
import { UsersService } from '../users.service';
import { ChangePasswordBasicDto } from '../dtos/change-password-basic.dto';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/auth/types';

@Controller('me')
export class MeController {
  private static readonly PASSWORD_CHANGE_LIMIT = 5; // max 5 attempts
  private static readonly PASSWORD_CHANGE_WINDOW = 60000; // 1 minute

  constructor(private readonly usersService: UsersService) {}

  @Put('password')
  @Throttle({
    default: {
      limit: MeController.PASSWORD_CHANGE_LIMIT,
      ttl: MeController.PASSWORD_CHANGE_WINDOW,
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
}
