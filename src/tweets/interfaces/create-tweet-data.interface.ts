import { Mention } from './mention.interface';

export interface CreateTweetData {
  userId: bigint;
  content: string;

  Mentions: Mention[];
  // Hashtags: Hashtag[];

  replyToTweetId: bigint | null;
  quotedTweetId: bigint | null;

  hasMedia: boolean;
}
