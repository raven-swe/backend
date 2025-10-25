import { Body, Controller, Get, Headers, Post, Query, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { StartRegistrationDto } from './dto/start-registration.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyForgotPasswordDto } from './dto/verify-forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendPasswordOtpDto } from './dto/resend-password-otp.dto';
import { CheckEmailDto } from './dto/check-email-dto';
import { AUTH_CONFIG } from './constants/auth.constants';
import type { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/start')
  async startRegistration(@Body() startRegistrationDto: StartRegistrationDto) {
    return this.authService.startRegistration(startRegistrationDto);
  }

  @Post('register/verify')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return await this.authService.verifyOtp(verifyOtpDto);
  }

  @Post('register/complete')
  async completeRegistration(
    @Req() req: Request,
    @Body() completeRegistrationDto: CompleteRegistrationDto,
    @Headers('X-Client-Type') clientType: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip;
    const { accessToken, refreshToken } = await this.authService.completeRegistration(
      completeRegistrationDto,
      ipAddress,
      clientType,
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: AUTH_CONFIG.REFRESH_TOKEN_TTL,
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
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('password/forgot/verify')
  async verifyForgotPasswordOtp(@Body() verifyForgotPasswordOtp: VerifyForgotPasswordDto) {
    return await this.authService.verifyForgotPassword(verifyForgotPasswordOtp);
  }

  @Post('password/reset')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return await this.authService.resetPassword(resetPasswordDto);
  }

  @Post('password/resend-otp')
  async resendPasswordOtp(@Body() resendPasswordOtpDto: ResendPasswordOtpDto) {
    return await this.authService.resendPasswordOtp(resendPasswordOtpDto);
  }
}
