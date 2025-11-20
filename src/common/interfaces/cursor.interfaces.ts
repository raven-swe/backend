export type FollowsCursor = {
  followerId: string;
  followedId: string;
};

export type BlocksCursor = {
  userId: string;
  blockedId: string;
};

export type TweetsCursor = {
  id: string;
};

export type FeedCursor = {
  createdAt: Date;
  id: string;
};
