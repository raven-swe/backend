export type UserInteractionsCursor = { userId: string; tweetId: string };
export type UserSearchCursor = { rankingScore: bigint; id: string };

export type TweetRelationsCursor = {
  type?: 'relations';
  createdAt: Date;
  id: string;
};

export type TweetRankCursor = {
  type?: 'rank';
  rank: string;
  id: string;
};

export function isTweetRankCursor(
  cursor: TweetRankCursor | TweetRelationsCursor | undefined,
): cursor is TweetRankCursor {
  return cursor ? cursor.type === 'rank' && 'rank' in cursor : false;
}

export function isTweetRelationsCursor(
  cursor: TweetRankCursor | TweetRelationsCursor | undefined,
): cursor is TweetRelationsCursor {
  return cursor ? cursor.type === 'relations' && 'createdAt' in cursor : false;
}
