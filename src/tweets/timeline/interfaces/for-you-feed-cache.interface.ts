export interface ForYouFeedCache {
  tweets: Array<{
    id: string;
    score: number;
    retweeterId?: string;
  }>;

  generatedAt: number; // timestamp in milliseconds
}
