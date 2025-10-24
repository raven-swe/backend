import { Body, Controller, Patch, Post, Put } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { Throttle } from '@nestjs/throttler';
import { InititateEmailUpdateDto } from 'src/users/dtos/initiate-email-update.dto';
import { VerifyEmailUpdateDto } from 'src/users/dtos/verify-email-update.dto';
import { ResendEmailUpdateOtp } from 'src/users/dtos/resend-email-update-otp.dto';
import { UpdateUsernameDto } from 'src/users/dtos/update-username.dto';

@Controller('me/settings')
export class SettingsController {
  private static readonly PASSWORD_CHANGE_LIMIT = 5; // max 5 attempts
  private static readonly PASSWORD_CHANGE_WINDOW = 60000; // 1 minute
  constructor(private readonly settingsService: SettingsService) {}

  @Put('email')
  @Throttle({
    default: {
      limit: SettingsController.PASSWORD_CHANGE_LIMIT,
      ttl: SettingsController.PASSWORD_CHANGE_WINDOW,
    },
  })
  // @UseGuards(JwtAuthGuard) // TODO: Enable after auth is ready
  async inititateEmailUpdate(@Body() inititateEmailUpdateDto: InititateEmailUpdateDto) {
    // const userId = req.user.id;
    const userId = BigInt(1); // temporary userId for testing
    return this.settingsService.checkNewEmail(userId, inititateEmailUpdateDto);
  }

  @Post('email/verify')
  // @UseGuards(JwtAuthGuard) // TODO: Enable after auth is ready
  async verifyUpdateEmailOtp(@Body() verifyEmailUpdateDto: VerifyEmailUpdateDto) {
    // const userId = req.user.id;
    const userId = BigInt(1); // temporary userId for testing
    return this.settingsService.verifyEmailUpdate(userId, verifyEmailUpdateDto);
  }

  @Post('email/resend-otp')
  // @UseGuards(JwtAuthGuard) // TODO: Enable after auth is ready
  async resendUpdateEmailOtp(@Body() resendEmailUpdateOtp: ResendEmailUpdateOtp) {
    // const userId = req.user.id;
    const userId = BigInt(1); // temporary userId for testing
    return this.settingsService.resendEmailUpdateOtp(userId, resendEmailUpdateOtp);
  }

  @Patch('username')
  // @UseGuards(JwtAuthGuard) // TODO: Enable after auth is ready
  async updateUsername(@Body() updateUsernameDto: UpdateUsernameDto) {
    // const userId = req.user.id;
    const userId = BigInt(1); // temporary userId for testing
    return this.settingsService.updateUsername(userId, updateUsernameDto);
  }
}
