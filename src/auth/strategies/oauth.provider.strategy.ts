import { ProviderProfile } from '../interfaces/oauth.interface';

export interface OAuthProviderStrategy {
  validateToken(providerTokenId: string): Promise<ProviderProfile>;
}
