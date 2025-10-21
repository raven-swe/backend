import { Controller, Post, Body, Param, Headers } from '@nestjs/common';
import { oAuthService } from './oauth.service';
import * as useragent from 'useragent';
import { BadRequestException } from '@nestjs/common';
import {
  SUPPORTED_OAUTH_PROVIDERS,
  SupportedOAuthProvider,
} from './constants/supported-oauth-providers';
import { OauthCallbackDto } from './dtos/oauth-callback.dto';
import { OauthCompleteDto } from './dtos/oauth-complete.dto';

@Controller('oauth')
export class OauthController {
  constructor(private readonly oAuthService: oAuthService) {}

  @Post(':provider/callback')
  async providerCallback(
    @Param('provider') provider: string,
    @Body() oAuthCallbackDto: OauthCallbackDto,
    @Headers('user-agent') agentString: string,
  ) {
    const agent = useragent.parse(agentString);

    if (!SUPPORTED_OAUTH_PROVIDERS.includes(provider as SupportedOAuthProvider)) {
      throw new BadRequestException('Unsupported provider');
    }

    return this.oAuthService.handleOauthToken(
      provider as SupportedOAuthProvider,
      oAuthCallbackDto.providerTokenId,
      agent,
    );
  }

  @Post('complete')
  async completeOauthRegister(
    @Body() oAuthCompleteDto: OauthCompleteDto,
    @Headers('user-agent') agentString: string,
  ) {
    const agent = useragent.parse(agentString);

    return this.oAuthService.completeOauthRegister(
      oAuthCompleteDto.creationToken,
      oAuthCompleteDto.birthDate,
      agent,
    );
  }
}
