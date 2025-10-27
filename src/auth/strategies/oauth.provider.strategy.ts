import { ProviderProfile } from '../types/oauth.type';

export interface OAuthProviderStrategy {
  validateToken(providerToken: string): Promise<ProviderProfile>;
}
