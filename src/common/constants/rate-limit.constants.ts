export const RATE_LIMIT = {
  GLOBAL: {
    TTL: 60_000, // 1 minute
    LIMIT: 60, // 60 requests per minute
  },
};
