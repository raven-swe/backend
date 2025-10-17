import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { StartRegistrationDto } from './dto/start-registration.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { CheckEmailDto } from './dto/CheckEmailDto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { RecaptchaFailedException } from './exceptions/recaptcha.exception';
import type { Response } from 'express';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyForgotPasswordDto } from './dto/verify-forgot-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/start')
  async startRegistration(@Body() startRegistrationDto: StartRegistrationDto) {
    const valid = await this.authService.verifyRecaptcha(startRegistrationDto.recaptchaToken);
    if (!valid) {
      throw new RecaptchaFailedException();
    }
    return this.authService.startRegistration(startRegistrationDto);
  }

  @Post('register/verify')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return await this.authService.verifyOtp(verifyOtpDto);
  }

  @Post('register/complete')
  async completeRegistration(
    @Body() completeRegistrationDto: CompleteRegistrationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } =
      await this.authService.completeRegistration(completeRegistrationDto);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  @Post('register/resend-otp')
  async resendOtp(@Body() creationTokenDto: ResendOtpDto) {
    return await this.authService.resendOtp(creationTokenDto.creationToken);
  }

  @Get('check-email')
  async checkEmail(@Query() checkEmailDto: CheckEmailDto) {
    return await this.authService.checkEmail(checkEmailDto.email);
  }

  @Post('password/forgot')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    const valid = await this.authService.verifyRecaptcha(forgotPasswordDto.recaptchaToken);
    if (!valid) {
      throw new RecaptchaFailedException();
    }
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('password/forgot/verify')
  async verifyForgotPasswordOtp(@Body() verifyForgotPasswordOtp: VerifyForgotPasswordDto) {
    return await this.authService.verifyForgotPassword(verifyForgotPasswordOtp);
  }
}
