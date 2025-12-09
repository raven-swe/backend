import { TweetEntitiesDto } from './tweet-entitites.dto';
import { MediaResponseDto } from 'src/media/dtos/media-response.dto';
import { CompactAuthorDto } from './compact-author.dto';
import { DeletedTweet } from '../types';
export class TweetDto {
  id: string;
  author: CompactAuthorDto;
  content: string | null;
  createdAt: Date;

  replyCount: number;
  retweetCount: number;
  likeCount: number;

  isLiked: boolean;
  isRetweeted: boolean;

  entities: TweetEntitiesDto;
  media: MediaResponseDto[];

  replyToTweetId: string | null;
  quoteToTweetId: string | null;

  quotedTweet?: TweetDto | DeletedTweet;

  repostedBy?: Retweeter;
}

type Retweeter = Omit<CompactAuthorDto, 'avatarUrl'>;
