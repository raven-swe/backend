import { Mention } from './mention-interface';
import { Hashtag } from './hashtag-interface';

export interface ParsedContent {
  mentions: Mention[];
  hashtags: Hashtag[];
}
