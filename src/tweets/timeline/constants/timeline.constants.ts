export const TIMELINE_MAX_SIZE = 1000 as const;
export const TIMELINE_CACHE_TTL = 864000000 as const; // 10 days
export const TWEET_AUTHOR_CACHE_TTL = 86400000 as const; // 1 day
export const TIMELINE_EMPTY_PLACEHOLDER_TTL = 86400 as const; // 1 day in seconds

export const LIKE_COUNT_CACHE_TTL = 86400 as const; // 1 day in seconds
export const RETWEET_COUNT_CACHE_TTL = 86400 as const; // 1 day in seconds

export const TWEET_STATIC_DATA_CACHE_TTL = 86400; // 1 days in seconds
export const AUTHOR_COMPACT_DATA_CACHE_TTL = 86400; // 1 days in seconds

export const USER_FOLLOWINGS_CACHE_TTL = 432000 as const; // 5 days in seconds
export const USER_MUTED_CACHE_TTL = 432000 as const; // 5 days in seconds
