import { Mention } from 'src/common/interfaces/mention-interface';
import { Hashtag } from 'src/common/interfaces/hashtag-interface';
export class TweetEntitiesDto {
  mentions: Mention[];
  hashtags: Hashtag[];
}
