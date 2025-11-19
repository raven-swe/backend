import { TweetDto } from 'src/tweets/dtos';

export type QuotesCursor = Pick<TweetDto, 'createdAt' | 'id'>;
export type RetweetersCursor = { userId: string; tweetId: string };
