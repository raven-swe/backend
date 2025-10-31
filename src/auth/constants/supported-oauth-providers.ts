export const SUPPORTED_OAUTH_PROVIDERS = ['github', 'google'] as const;
export type SupportedOAuthProvider = (typeof SUPPORTED_OAUTH_PROVIDERS)[number];
