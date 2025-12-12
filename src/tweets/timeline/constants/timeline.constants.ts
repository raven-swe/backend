export const TIMELINE_MAX_SIZE = 1000 as const;
export const TIMELINE_CACHE_TTL = 864000 as const; // 10 days in seconds
export const TIMELINE_EMPTY_PLACEHOLDER_TTL = 86400 as const; // 1 day in seconds

export const COUNT_CACHE_TTL = 86400; // 1 days in seconds

export const TWEET_STATIC_DATA_CACHE_TTL = 86400; // 1 days in seconds
export const AUTHOR_COMPACT_DATA_CACHE_TTL = 86400; // 1 days in seconds

export const USER_FOLLOWINGS_CACHE_TTL = 432000 as const; // 5 days in seconds
export const USER_MUTED_CACHE_TTL = 432000 as const; // 5 days in seconds

export const SEEN_IDS_CURSOR_LIMIT = 100 as const;

export const FOR_YOU_FEED_BASE_TTL = 5 * 60; // 5 minutes
export const FOR_YOU_FEED_SCROLL_TTL = 2 * 60 * 60; // 2 hours (sliding window)
export const FOR_YOU_SEEN_CACHE_TTL = 30 * 60; // 30 minutes
export const FOR_YOU_FEED_SIZE = 400;
