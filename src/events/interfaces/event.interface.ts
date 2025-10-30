export enum DomainEvent {
  User_Followed = 'user.followed',
  Tweet_Liked = 'tweet.liked',
  Tweet_Replied = 'tweet.replied',
  Tweet_Quoted = 'tweet.quoted',
  Tweet_Retweeted = 'tweet.retweeted',
  Tweet_Created = 'tweet.created',
  User_Mentioned = 'user.mentioned',
}

interface UserEvent {
  actorId: string;
  receiverId: string;
}

interface TweetEvent {
  actorId: string;
  receiverId: string;
  tweetId: string;
}

export type UserFollowedEvent = UserEvent;
export type UserMentionedEvent = TweetEvent;
export type TweetCreatedEvent = TweetEvent;
export type TweetLikedEvent = TweetEvent;
export type TweetRetweetedEvent = TweetEvent;
export type TweetRepliedEvent = TweetEvent;
export type TweetQuotedEvent = TweetEvent;
