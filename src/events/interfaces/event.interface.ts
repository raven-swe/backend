export const DOMAIN_EVENT_NAMES = {
  User_Followed: 'user.followed',
  Tweet_Liked: 'tweet.liked',
  Tweet_Retweeted: 'tweet.retweeted',
  Tweet_Created: 'tweet.created',
  Message_Created: 'message.created',
  Reaction_Created: 'reaction.created',
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

interface MessageEvent {
  actorId: bigint;
  receiverId: bigint;
  conversationId: bigint;
  messagePreview: string;
  hasMedia: boolean;
}

interface ReactionEvent {
  actorId: bigint;
  receiverId: bigint;
  conversationId: bigint;
  messagePreview: string;
  reaction: string | null;
}

export type UserFollowedEvent = UserEvent;
export type TweetLikedEvent = TweetEvent;
export type TweetRetweetedEvent = TweetEvent;
export type MessageCreatedEvent = MessageEvent;
export type ReactionSentEvent = ReactionEvent;

export type TweetCreatedEvent = {
  tweetId: bigint;
  authorId: bigint;

  replyToTweetId: bigint | null;
  quoteToTweetId?: bigint | null;
  mentionedUserIds: bigint[];
};
