export const DOMAIN_EVENT_NAMES = {
  User_Followed: 'user.followed',
  Tweet_Liked: 'tweet.liked',
  Tweet_Retweeted: 'tweet.retweeted',
  Tweet_Created: 'tweet.created',
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
