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
