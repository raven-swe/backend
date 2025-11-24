export const TWEETS_ERROR_CODES = {
  TWEET_NOT_FOUND: 'TWEET_NOT_FOUND',
  CONFLICTING_LIKE: 'CONFLICTING_LIKE',
  CONFLICTING_RETWEET: 'CONFLICTING_RETWEET',
  USER_BLOCKED: 'USER_BLOCKED',
  INVALID_CURSOR: 'INVALID_CURSOR',
  INVALID_TWEET_CREATION: 'INVALID_TWEET_CREATION',
  INVALID_TWEET_PAYLOAD: 'INVALID_TWEET_PAYLOAD',
  INVALID_MEDIA: 'INVALID_MEDIA',
  TOO_MANY_MEDIA: 'TOO_MANY_MEDIA',
  TWEET_FORBIDDEN_DELETION: 'TWEET_FORBIDDEN_DELETION',
  INVALID_MEDIA_ID: 'INVALID_MEDIA_ID',
};

export const TWEETS_ERROR_MESSAGES = {
  TWEET_NOT_FOUND: 'Tweet not found.',
  CONFLICTING_LIKE: 'You have already liked or unliked this tweet.',
  CONFLICTING_RETWEET: 'You have already retweeted or unretweeted this tweet.',
  USER_BLOCKED: 'You are blocked from interacting with this tweet.',
  INVALID_TWEET_CREATION: 'Cannot reply and quote a tweet at the same time.',
  INVALID_TWEET_PAYLOAD: 'Tweet must have content or media.',
  INVALID_MEDIA: 'One or more media items are invalid.',
  TOO_MANY_MEDIA: 'A tweet cannot have more than 4 media items.',
  TWEET_FORBIDDEN_DELETION: 'You do not have permission to delete this tweet.',
  INVALID_CURSOR: 'The provided cursor is invalid.',
  INVALID_MEDIA_ID: 'One or more media IDs are invalid.',
};
