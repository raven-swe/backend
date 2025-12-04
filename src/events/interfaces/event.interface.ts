export const DOMAIN_EVENT_NAMES = {
  User_Followed: 'user.followed',
  Tweet_Liked: 'tweet.liked',
  Tweet_Replied: 'tweet.replied',
  Tweet_Quoted: 'tweet.quoted',
  Tweet_Retweeted: 'tweet.retweeted',
  Tweet_Created: 'tweet.created',
  User_Mentioned: 'user.mentioned',
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
export type UserMentionedEvent = TweetEvent;
export type TweetCreatedEvent = TweetEvent;
export type TweetLikedEvent = TweetEvent;
export type TweetRetweetedEvent = TweetEvent;
export type TweetRepliedEvent = TweetEvent;
export type TweetQuotedEvent = TweetEvent;
