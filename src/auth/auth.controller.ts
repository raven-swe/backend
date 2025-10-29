import {
  BadRequestException,
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
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { createValidationError } from 'src/common/utils/create-validation-error.util';

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
    @Headers('X-Client-Type') clientType: 'web' | 'mobile',
    @DeviceType() deviceType: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.validateClientType(clientType);
    const ipAddress = req.ip;
    const { accessToken, refreshToken } = await this.authService.completeRegistration(
      completeRegistrationDto,
      ipAddress,
      deviceType,
    );

    if (clientType === 'mobile') {
      return { accessToken, refreshToken };
    }
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'none',
      maxAge: AUTH_CONFIG.REFRESH_TOKEN_TTL,
    });
    return { accessToken };
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
    this.validateClientType(clientType);
    const { accessToken, refreshToken } = await this.authService.login(user, deviceType, ipAddress);
    if (clientType === 'mobile') {
      return { accessToken, refreshToken };
    }
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'none',
      maxAge: AUTH_CONFIG.REFRESH_TOKEN_TTL,
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
    @Body() refreshTokenDto: RefreshTokenDto | undefined,
    @Res({ passthrough: true }) res: Response,
    @Headers('X-Client-Type') clientType: 'web' | 'mobile',
  ) {
    this.validateClientType(clientType);
    let refreshToken;
    if (clientType === 'web') {
      refreshToken = req.cookies?.refreshToken;
    } else if (clientType === 'mobile') {
      const body = refreshTokenDto && typeof refreshTokenDto === 'object' ? refreshTokenDto : {};
      const dto = plainToClass(RefreshTokenDto, body);
      const errors = await validate(dto);

      if (errors.length > 0) {
        throw new BadRequestException(
          createValidationError('refreshToken', { isString: 'Refresh token must be a string' }),
        );
      }
      refreshToken = dto.refreshToken;
    }
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not provided, please log in again.');
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refreshAccessToken(refreshToken);

    if (clientType == 'mobile') {
      return { accessToken, refreshToken: newRefreshToken };
    }
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'none',
      maxAge: AUTH_CONFIG.REFRESH_TOKEN_TTL,
    });
    return { accessToken };
  }

  private validateClientType(clientType: string) {
    if (!clientType) {
      throw new BadRequestException({
        message: 'Missing X-Client-Type header',
      });
    }
    if (!clientType.toUpperCase().includes('WEB') && !clientType.toUpperCase().includes('MOBILE')) {
      throw new BadRequestException({
        message: 'Invalid X-Client-Type header',
      });
    }
  }
}
