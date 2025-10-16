import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OAuthProviderGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const supportedProviders = ['github', 'google']; // Supported providers for easy extend

    const req: Request = context.switchToHttp().getRequest();
    const provider = req.params.provider;
    if (!supportedProviders.includes(provider)) {
      throw new Error('Unsupported provider');
    }
    const guard = AuthGuard(provider);
    return (await new guard().canActivate(context)) as boolean;
  }
}
