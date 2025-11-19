import { TweetDto } from 'src/tweets/dtos';

export type QuotesCursor = Pick<TweetDto, 'createdAt' | 'id'>;
