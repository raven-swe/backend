import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
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
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { User, IPAddress } from './decorators';
import { Throttle } from '@nestjs/throttler';
import { CheckIdentifierQueryDto } from './dtos';
import { DeviceType } from './decorators/';
import type { RequestUser, RequestWithCookies } from './types';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenDto } from './dtos';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

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

  @Post('refresh-token')
  @HttpCode(200)
  async refrehAccessToken(
    @Req() req: RequestWithCookies,
    @Body() refreshTokenDto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
    @Headers('X-Client-Type') clientType: 'web' | 'mobile',
  ) {
    if (!clientType) {
      throw new UnauthorizedException();
    }
    let refreshToken;
    if (clientType === 'web') {
      refreshToken = req.cookies?.refresh_token;
    } else if (clientType === 'mobile') {
      refreshToken = refreshTokenDto.refresh_token;
    }
    if (!refreshToken) {
      throw new UnauthorizedException('missing refresh token');
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refreshAccessToken(refreshToken);

    const daysToMillis = 24 * 60 * 60 * 1000;
    if (clientType == 'mobile') {
      return { accessToken, refreshToken: newRefreshToken };
    }
    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'none',
      maxAge:
        this.config.get('REFRESH_TOKEN_EXPIRES_IN_SECONDS') * daysToMillis || 30 * daysToMillis,
    });
    return { accessToken };
  }
}
