import { Body, Controller, Put, Get, Patch, UseGuards } from '@nestjs/common';
import { UsersService } from '../users.service';
import { ChangePasswordBasicDto } from '../dtos/change-password-basic.dto';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/auth/types';
import { RATE_LIMIT } from 'src/common/constants/rate-limit.constants';
import { UpdateProfileDto } from '../dtos/update-profile.dto';

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

  @Patch()
  async updateProfile(
    @Body() updateProfileDto: Partial<UpdateProfileDto>,
    // @Request() req -- enable after merging login functionality
  ) {
    // const userId = req.user.id;
    const userId = BigInt(18); // temporary userId for testing
    const profile = await this.usersService.updateProfile(userId, updateProfileDto);

    return {
      message: 'Profile updated successfully',
      ...profile,
    };
  }

  @Get()
  async getMyProfile() {
    // @Request() req -- enable after merging login functionality
    // const username = req.user.username;
    const username = 'OmarHassan'; // temporary username for testing
    return this.usersService.getUserProfile(username);
  }
}
