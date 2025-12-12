export interface ForYouFeedCache {
  tweets: Array<{
    id: string;
    score: number;
  }>;

  generatedAt: number; // timestamp in milliseconds
}
