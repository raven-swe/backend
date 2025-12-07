import { TweetEntitiesDto } from './tweet-entitites.dto';
import { MediaResponseDto } from 'src/media/dtos/media-response.dto';
import { CompactAuthorDto } from './compact-author.dto';
export class TweetDto {
  id: string;
  author: CompactAuthorDto;
  //TODO null content will be handled later for media tweets
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

  quotedTweet?: TweetDto;

  repostedBy?: Retweeter;
}

type Retweeter = Omit<CompactAuthorDto, 'avatarUrl'>;
