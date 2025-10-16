import { Controller, Post, Body, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
import { BadRequestException } from '@nestjs/common';
import {
  SUPPORTED_OAUTH_PROVIDERS,
  SupportedOAuthProvider,
} from './constants/supported-oauth-providers';

@Controller('oauth')
export class OauthController {
  constructor(private readonly authService: AuthService) {}

  @Post(':provider/callback')
  async providerCallback(
    @Param('provider') provider: string,
    @Body('provider_token_id') providerTokenId: string,
  ) {
    if (!providerTokenId) {
      throw new BadRequestException('provider_token_id is required in request body');
    }

    if (!SUPPORTED_OAUTH_PROVIDERS.includes(provider as any)) {
      throw new BadRequestException('Unsupported provider');
    }

    return this.authService.handleOauthToken(provider as SupportedOAuthProvider, providerTokenId);
  }

  @Post('complete')
  async completeOauthRegister(@Body() body: { creationToken: string; birthDate: string }) {
    if (!body || !body.creationToken || !body.birthDate) {
      throw new BadRequestException('creationToken and birthDate are required in request body');
    }
    return this.authService.completeOauthRegister(body.creationToken, body.birthDate);
  }
}
