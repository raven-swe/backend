import { ProviderProfile } from '../types/oauth.type';

export interface OAuthProviderStrategy {
  validateToken(providerToken: string, deviceType: string): Promise<ProviderProfile>;
}
