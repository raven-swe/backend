import { Controller, Post, Body, Param, Headers, Res, UnauthorizedException } from '@nestjs/common';
import { oAuthService } from './oauth.service';
import { BadRequestException } from '@nestjs/common';
import {
  SUPPORTED_OAUTH_PROVIDERS,
  SupportedOAuthProvider,
} from './constants/supported-oauth-providers';
import { OauthCallbackDto } from './dto/oauth-callback.dto';
import type { Response } from 'express';
import { OauthCompleteDto } from './dto/oauth-complete.dto';
import { createValidationError } from 'src/common/utils/create-validation-error.util';
import { DeviceType, IPAddress } from './decorators';
import { ConfigService } from '@nestjs/config';

@Controller('oauth')
export class OauthController {
  constructor(
    private readonly oAuthService: oAuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post(':provider/callback')
  async providerCallback(
    @Param('provider') provider: string,
    @Body() oAuthCallbackDto: OauthCallbackDto,
    @IPAddress() ipAddress: string,
    @DeviceType() deviceType: string,
    @Res({ passthrough: true }) res: Response,
    @Headers('X-Client-Type') clientType: 'web' | 'mobile',
  ) {
    if (!SUPPORTED_OAUTH_PROVIDERS.includes(provider as SupportedOAuthProvider)) {
      throw new BadRequestException(
        createValidationError('provider', {
          invalidParam: `Unsupported OAuth provider: ${provider}`,
        }),
      );
    }

    const result = await this.oAuthService.handleOauthToken(
      provider as SupportedOAuthProvider,
      oAuthCallbackDto.providerToken,
      deviceType,
      ipAddress,
    );

    if ('accessToken' in result && 'refreshToken' in result) {
      const { accessToken, refreshToken } = result;
      const daysToMillis = 24 * 60 * 60 * 1000;

      if (!clientType) {
        throw new UnauthorizedException();
      }

      if (clientType === 'mobile') {
        return { accessToken, refreshToken };
      }

      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: this.configService.get('NODE_ENV') === 'production',
        sameSite: 'none',
        maxAge:
          this.configService.get('REFRESH_TOKEN_EXPIRES_IN_DAYS') * daysToMillis ||
          30 * daysToMillis,
      });

      return { accessToken };
    }

    return result;
  }

  @Post('complete')
  async completeOauthRegister(
    @IPAddress() ipAddress: string,
    @DeviceType() deviceType: string,
    @Res({ passthrough: true }) res: Response,
    @Body() oAuthCompleteDto: OauthCompleteDto,
    @Headers('X-Client-Type') clientType: 'web' | 'mobile',
  ) {
    const { accessToken, refreshToken } = await this.oAuthService.completeOauthRegister(
      oAuthCompleteDto.creationToken,
      oAuthCompleteDto.birthDate,
      deviceType,
      ipAddress,
    );

    const daysToMillis = 24 * 60 * 60 * 1000;

    if (!clientType) {
      throw new UnauthorizedException();
    }

    if (clientType === 'mobile') {
      return { accessToken, refreshToken };
    }

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'none',
      maxAge:
        this.configService.get('REFRESH_TOKEN_EXPIRES_IN_DAYS') * daysToMillis || 30 * daysToMillis,
    });

    return { accessToken };
  }
}
