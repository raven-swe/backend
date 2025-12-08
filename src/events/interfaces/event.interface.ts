export const DOMAIN_EVENT_NAMES = {
  User_Followed: 'user.followed',
  Tweet_Liked: 'tweet.liked',
  Tweet_Retweeted: 'tweet.retweeted',
  Tweet_Created: 'tweet.created',
  Tweet_Deleted: 'tweet.deleted',
  User_Unfollowed: 'user.unfollowed',
  Tweet_Unliked: 'tweet.unliked',
  Tweet_Unretweeted: 'tweet.unretweeted',
} as const;

interface UserEvent {
  actorId: bigint;
  receiverId: bigint;
}

interface TweetEvent {
  actorId: bigint;
  receiverId: bigint;
  tweetId: bigint;
}

export type UserFollowedEvent = UserEvent;
export type TweetLikedEvent = TweetEvent;
export type TweetRetweetedEvent = TweetEvent;

export type TweetCreatedEvent = {
  tweetId: bigint;
  authorId: bigint;

  replyToTweetId: bigint | null;
  quoteToTweetId?: bigint | null;
  mentionedUserIds: bigint[];
};

export type TweetDeletedEvent = TweetCreatedEvent;

export type UserUnfollowedEvent = UserEvent;
export type TweetUnlikedEvent = TweetEvent;
export type TweetUnretweetedEvent = TweetEvent;
