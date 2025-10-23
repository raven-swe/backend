import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import { UsersService } from '../users.service';
import { ChangePasswordBasicDto } from '../dtos/change-password-basic.dto';
import { Throttle } from '@nestjs/throttler';
import { UpdateProfileDto } from '../dtos/update-profile.dto';

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
  // TODO: enable after merging login functionality
  // @UseGuards(JwtAuthGuard)
  async changePassword(
    @Body() changePasswordDto: ChangePasswordBasicDto,
    // @Request() req -- enable after merging login functionality
  ) {
    // const userId = req.user.id;
    const userId = BigInt(18); // temporary userId for testing
    return this.usersService.changePassword(userId, changePasswordDto);
  }

  @Patch()
  async updateProfile(
    @Body() updateProfileDto: UpdateProfileDto,
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
