import { Body, Controller, Post, Put, UseGuards, Patch, Get } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { Throttle } from '@nestjs/throttler';
import { InititateEmailUpdateDto } from 'src/users/dtos/initiate-email-update.dto';
import { VerifyEmailUpdateDto } from 'src/users/dtos/verify-email-update.dto';
import { ResendEmailUpdateOtp } from 'src/users/dtos/resend-email-update-otp.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/auth/types';
import { UpdateUsernameDto } from 'src/users/dtos/update-username.dto';
import { UpdateBirthDateDto } from 'src/users/dtos/update-birth-date.dto';

@Controller('me/settings')
export class SettingsController {
  private static readonly EMAIL_UPDATE_LIMIT = 5;
  private static readonly EMAIL_UPDATE_WINDOW = 60000;
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getUserDetails(@User() user: RequestUser) {
    const userId = BigInt(user.id);
    return this.settingsService.getUserDetails(userId);
  }

  @Put('email')
  @Throttle({
    default: {
      limit: SettingsController.EMAIL_UPDATE_LIMIT,
      ttl: SettingsController.EMAIL_UPDATE_WINDOW,
    },
  })
  @UseGuards(JwtAuthGuard)
  async inititateEmailUpdate(
    @Body() inititateEmailUpdateDto: InititateEmailUpdateDto,
    @User() user: RequestUser,
  ) {
    const userId = BigInt(user.id);
    return this.settingsService.checkNewEmail(userId, inititateEmailUpdateDto);
  }

  @Post('email/verify')
  @UseGuards(JwtAuthGuard)
  async verifyUpdateEmailOtp(
    @Body() verifyEmailUpdateDto: VerifyEmailUpdateDto,
    @User() user: RequestUser,
  ) {
    const userId = BigInt(user.id);
    return this.settingsService.verifyEmailUpdate(userId, verifyEmailUpdateDto);
  }

  @Post('email/resend-otp')
  @UseGuards(JwtAuthGuard)
  async resendUpdateEmailOtp(
    @Body() resendEmailUpdateOtp: ResendEmailUpdateOtp,
    @User() user: RequestUser,
  ) {
    const userId = BigInt(user.id);
    return this.settingsService.resendEmailUpdateOtp(userId, resendEmailUpdateOtp);
  }

  @Patch('username')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async updateUsername(@Body() updateUsernameDto: UpdateUsernameDto, @User() user: RequestUser) {
    const userId = BigInt(user.id);
    return this.settingsService.updateUsername(userId, updateUsernameDto);
  }

  @Put('birthdate')
  @UseGuards(JwtAuthGuard)
  async updateBirthDate(@Body() updateBirthDateDto: UpdateBirthDateDto, @User() user: RequestUser) {
    const userId = BigInt(user.id);
    return this.settingsService.updateBirthDate(userId, updateBirthDateDto.date);
  }

  @Get('connected-accounts')
  @UseGuards(JwtAuthGuard)
  async getUserSSOs(@User() user: RequestUser) {
    const userId = BigInt(user.id);
    return this.settingsService.getUserSSOs(userId);
  }
}
