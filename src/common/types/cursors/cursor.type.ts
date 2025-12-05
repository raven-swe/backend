import { TweetDto } from 'src/tweets/dtos';

export type TweetRelationsCursor = Pick<TweetDto, 'createdAt' | 'id'>;
export type UserInteractionsCursor = { userId: string; tweetId: string };
export type UserSearchCursor = { simScore: number; createdAt: Date; id: string };
