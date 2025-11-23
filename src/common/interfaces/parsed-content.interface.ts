import { PlainMention, PlainHashtag } from 'src/tweets/interfaces';

export interface ParsedContent {
  mentions: PlainMention[];
  hashtags: PlainHashtag[];
}
