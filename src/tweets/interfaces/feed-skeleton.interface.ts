export interface FeedSkeleton {
  id: bigint;
  created_at: Date;
  type: 'tweet' | 'repost';
}
