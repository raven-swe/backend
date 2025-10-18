import { ProviderProfile } from '../types/oauth.type';

export interface OAuthProviderStrategy {
  validateToken(providerTokenId: string): Promise<ProviderProfile>;
}
