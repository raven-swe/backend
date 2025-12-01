export type FollowsCursor = {
  followerId: string;
  followedId: string;
};

export type MutesCursor = {
  userId: string;
  mutedId: string;
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

export type NotificationCursor = {
  latestEventAt: Date;
  id: string;
};
