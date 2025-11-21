export const TWEETS_ERROR_CODES = {
  TWEET_NOT_FOUND: 'TWEET_NOT_FOUND',
  CONFLICTING_LIKE: 'CONFLICTING_LIKE',
  CONFLICTING_RETWEET: 'CONFLICTING_RETWEET',
  USER_BLOCKED: 'USER_BLOCKED',
} as const;

export const TWEETS_ERROR_MESSAGES = {
  TWEET_NOT_FOUND: 'Tweet not found.',
  CONFLICTING_LIKE: 'You have already liked or unliked this tweet.',
  CONFLICTING_RETWEET: 'You have already retweeted or unretweeted this tweet.',
  USER_BLOCKED: 'You are blocked from interacting with this tweet.',
} as const;
