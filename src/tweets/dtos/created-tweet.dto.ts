export interface CreatedTweetDto {
  id: string;
  content?: string;
  media?: string[];
  entities?: {
    mentions?: { userId: string; startPosition: number }[];
    hashtags?: { hashtagId: string; startPosition: number }[];
  };
  replyToTweetId?: string;
  quoteToTweetId?: string;
}
