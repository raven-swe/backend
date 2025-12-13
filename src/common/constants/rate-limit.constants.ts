export const RATE_LIMIT = {
  GLOBAL: {
    TTL: 60_000, // 1 minute
    LIMIT: 60, // 60 requests per minute
  },
  PASSWORD_CHANGE: {
    LIMIT: 5, // max 5 attempts
    WINDOW_MS: 60000, // 1 minute
  },
  WRITE: {
    LIMIT: 10, // max 10 requests
    TTL: 60000, // 1 minute
  },
};
