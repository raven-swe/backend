export const TWEETS_ERROR_CODES = {
  TWEET_NOT_FOUND: 'TWEET_NOT_FOUND',
  CONFLICTING_LIKE: 'CONFLICTING_LIKE',
  CONFLICTING_RETWEET: 'CONFLICTING_RETWEET',
  USER_BLOCKED: 'USER_BLOCKED',
  INVALID_CURSOR: 'INVALID_CURSOR',
};

export const TWEETS_ERROR_MESSAGES = {
  TWEET_NOT_FOUND: 'The specified tweet does not exist.',
  CONFLICTING_LIKE: 'User has already liked/unliked this tweet.',
  CONFLICTING_RETWEET: 'User has already retweeted/unretweeted this tweet.',
  USER_BLOCKED: 'User is blocked from interacting with this tweet.',
  INVALID_CURSOR: 'The provided cursor is invalid.',
} as const;
