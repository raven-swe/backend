import { Controller, Post, UseGuards, Req, Body } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { OAuthProviderGuard } from './guards/oauth.provider.guard';

@Controller('oauth')
export class OauthController {
  constructor(private readonly authService: AuthService) {}

  @Post(':provider/callback')
  @UseGuards(OAuthProviderGuard)
  async providerCallback(@Req() req: Request) {
    if (!req.user) {
      throw new Error('OAuth authentication failed: user not found');
    }
    return this.authService.handlePassportOauth(
      req.user as {
        id: string;
        email: string;
        name: string;
        provider: string;
      },
    );
  }
  @Post('complete')
  async completeOauthRegister(@Body() body: { creationToken: string; birthDate: string }) {
    return this.authService.completeOauthRegister(body.creationToken, body.birthDate);
  }
}
