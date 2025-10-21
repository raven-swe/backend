import { Body, Controller, Get, Headers, Post, Query, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { StartRegistrationDto } from './dto/start-registration.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { CheckEmailDto } from './dto/check-email-dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { AUTH_CONFIG } from 'src/common/constants/auth.constants';
import type { Request, Response } from 'express';
import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import type { RequestUser } from './types';
import { User, IPAddress } from './decorators';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { CheckIdentifierQueryDto } from './dtos';
import { DeviceType } from './decorators/';

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
  @UseGuards(AuthGuard('local'))
  @UseGuards(LocalAuthGuard)
  @HttpCode(200)
  @Post('login')
  async login(
    @User() user: RequestUser,
    @IPAddress() ipAddress: string,
    @DeviceType() deviceType: string,
    @Res({ passthrough: true }) res: Response,
    @Headers('X-Client-Type') clientType: 'web' | 'mobile',
  ) {
    const { accessToken, refreshToken } = await this.authService.login(user, deviceType, ipAddress);
    const daysToMillis = 24 * 60 * 60 * 1000;
    if (!clientType) {
      throw new UnauthorizedException();
    }
    if (clientType === 'mobile') {
      return { accessToken, refreshToken };
    }
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'none',
      maxAge: this.config.get('REFRESH_TOKEN_EXPIRES_IN_DAYS') * daysToMillis || 30 * daysToMillis,
    });
    return { accessToken };
  }

  @Get('check-identifier')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async checkIdentifier(@Query() checkIdentifierQueryDto: CheckIdentifierQueryDto) {
    return await this.authService.checkIdentifier(checkIdentifierQueryDto.identifier);
  }
}
