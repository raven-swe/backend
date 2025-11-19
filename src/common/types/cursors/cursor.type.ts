import { TweetDto } from 'src/tweets/dtos';

export type QuotesCursor = Pick<TweetDto, 'createdAt' | 'id'>;
export type UserInteractionsCursor = { userId: string; tweetId: string };
