export interface DynamicDataFromCache {
  likeCounts: Map<bigint, number>;
  retweetCounts: Map<bigint, number>;
  replyCounts: Map<bigint, number>;
  userTweetInteractions: Map<bigint, { isLiked: boolean; isRetweeted: boolean }>;
}
