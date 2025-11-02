import { ProviderProfile } from '../types/oauth.type';

export interface OAuthProviderStrategy {
  validateToken(providerToken: string, clientType: string): Promise<ProviderProfile>;
}
