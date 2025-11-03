import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  Res,
  UnauthorizedException,
  Get,
  Query,
  InternalServerErrorException,
  Redirect,
  Logger,
} from '@nestjs/common';
import { OAuthService } from './oauth.service';
import { BadRequestException } from '@nestjs/common';
import {
  SUPPORTED_OAUTH_PROVIDERS,
  SupportedOAuthProvider,
} from './constants/supported-oauth-providers';
import { OauthCallbackDto } from './dto/oauth-callback.dto';
import type { Response } from 'express';
import { OauthCompleteDto } from './dto/oauth-complete.dto';
import { OAuthBridgeQueryDto } from './dto/oauth-bridge-query.dto';
import { createValidationError } from 'src/common/utils/create-validation-error.util';
import { DeviceType, IPAddress } from './decorators';
import { ConfigService } from '@nestjs/config';

@Controller('oauth')
export class OauthController {
  constructor(
    private readonly oAuthService: OAuthService,
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

    this.validateClientType(clientType);

    const result = await this.oAuthService.handleOauthToken(
      provider as SupportedOAuthProvider,
      oAuthCallbackDto.providerToken,
      deviceType,
      ipAddress,
      clientType,
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

  @Get(':provider/bridge')
  @Redirect()
  getProviderBridge(@Param('provider') provider: string, @Query() query: OAuthBridgeQueryDto) {
    try {
      if (!SUPPORTED_OAUTH_PROVIDERS.includes(provider as SupportedOAuthProvider)) {
        throw new BadRequestException(
          createValidationError('provider', {
            invalidParam: `Unsupported OAuth provider: ${provider}`,
          }),
        );
      }

      const { code, error, errorDescription, state } = query;

      if (!state) {
        throw new BadRequestException(
          createValidationError('state', { invalidParam: 'State parameter is required' }),
        );
      }

      let redirect: string;
      try {
        const decoded = Buffer.from(state, 'base64').toString();
        const parsed = JSON.parse(decoded) as {
          redirect?: string;
        };
        redirect = parsed.redirect ?? '';
        if (!redirect) throw new Error('Missing redirect in state');
      } catch {
        throw new BadRequestException(
          createValidationError('state', { invalidParam: 'Invalid state parameter' }),
        );
      }

      let appUrl: URL;
      try {
        appUrl = new URL(redirect);
      } catch {
        throw new BadRequestException(
          createValidationError('state', { invalidParam: 'Invalid state parameter' }),
        );
      }

      appUrl.searchParams.set('provider', provider);

      if (code) {
        appUrl.searchParams.set('code', code);
      }

      if (error) {
        appUrl.searchParams.set('error', error);
        if (errorDescription) {
          appUrl.searchParams.set('errorDescription', errorDescription);
        }
      }

      const finalUrl = appUrl.toString();
      Logger.log(`OAuth bridge redirecting to: ${finalUrl}`, 'OauthController');
      return { url: finalUrl };
    } catch (e) {
      if (e instanceof BadRequestException) {
        throw e;
      }
      throw new InternalServerErrorException({
        message: 'Failed to process OAuth bridge',
      });
    }
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
