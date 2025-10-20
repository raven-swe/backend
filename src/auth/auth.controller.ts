import { Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { StartRegistrationDto } from './dto/start-registration.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { CheckEmailDto } from './dto/CheckEmailDto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { RecaptchaFailedException } from './exceptions/recaptcha.exception';
import { RefreshTokenTTL } from './constants';
import type { Request, Response } from 'express';

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
    @Req() req: Request,
    @Body() completeRegistrationDto: CompleteRegistrationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip;
    const { accessToken, refreshToken } = await this.authService.completeRegistration(
      completeRegistrationDto,
      ipAddress,
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: RefreshTokenTTL,
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
}
