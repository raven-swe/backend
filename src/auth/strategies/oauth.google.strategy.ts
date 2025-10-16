import { OAuthProviderStrategy } from './oauth.provider.strategy';
import { ProviderProfile } from '../interfaces/oauth.interface';

export class GoogleOAuthStrategy implements OAuthProviderStrategy {
  async validateToken(providerTokenId: string): Promise<ProviderProfile> {
    // TODO: Implement Google token validation
    throw new Error('Google OAuth not implemented yet');
  }
}
