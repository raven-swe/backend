import { TweetDto } from 'src/tweets/dtos';

export type TweetRelationsCursor = Pick<TweetDto, 'createdAt' | 'id'>;
export type TweetRankCursor = { rank: number; id: string };
export type UserInteractionsCursor = { userId: string; tweetId: string };
export type UserSearchCursor = { rankingScore: bigint; id: string };
