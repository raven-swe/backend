// functions to get the keys for timeline caches

export const REDIS_TIMELINE_KEYS = {
  getUserTimelineKey: (userId: bigint): string => {
    return `timeline:${userId}`;
  },

  getTimelineItemTweetKey: (authorId: string, tweetId: string): string =>
    `${authorId}:${tweetId}:T`,

  getTimelineItemRetweetKey: (authorId: string, tweetId: string): string =>
    `${authorId}:${tweetId}:R`,

  getUserTimelineEmptyPlaceholderKey: (userId: bigint): string => `timeline:${userId}:empty`,

  getTweetStaticDataKey: (tweetId: bigint): string => `tweet:static:${tweetId}`,

  getAuthorDataKey: (authorId: bigint): string => `author:static:${authorId}`,

  getTweetLikesCountKey: (tweetId: bigint): string => `tweet:likes_count:${tweetId}`,

  getTweetRetweetsCountKey: (tweetId: bigint): string => `tweet:retweets_count:${tweetId}`,

  getTweetRepliesCountKey: (tweetId: bigint): string => `tweet:replies_count:${tweetId}`,

  getUserTweetInteractionKey: (userId: bigint, tweetId: bigint): string =>
    `user:${userId}:tweet_interaction:${tweetId}`,

  getUserInteractionsKey: (userId: bigint): string => `user:${userId}:interactions`,

  // these are items inside the cuckoo filter stored at getUserInteractionsKey
  getUserInteractionsLikeItem: (tweetId: bigint): string => `like:${tweetId}`,

  getUserInteractionsRetweetItem: (tweetId: bigint): string => `retweet:${tweetId}`,
};
