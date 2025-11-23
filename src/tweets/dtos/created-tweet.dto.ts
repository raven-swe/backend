import { PlainHashtag, PlainMention } from '../interfaces';

export interface CreatedTweetDto {
  id: string;
  content?: string;
  media?: string[];
  entities?: {
    mentions?: PlainMention[];
    hashtags?: PlainHashtag[];
  };
  replyToTweetId?: string;
  quoteToTweetId?: string;
}
