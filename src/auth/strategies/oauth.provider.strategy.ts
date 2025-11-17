import { ProviderProfile } from 'src/auth/interfaces';

export interface OAuthProviderStrategy {
  validateToken(providerToken: string, clientType: string): Promise<ProviderProfile>;
}
