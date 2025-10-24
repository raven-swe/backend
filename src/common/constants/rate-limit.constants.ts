export const RATE_LIMIT = {
  GLOBAL: {
    TTL: 60_000, // 1 minute
    LIMIT: 10, // 10 requests per minute
  },
};
