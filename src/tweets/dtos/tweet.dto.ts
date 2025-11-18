import { TweetEntitiesDto } from './tweet-entitites.dto';
import { AuthorDto } from './author.dto';
import { MediaResponseDto } from 'src/media/dtos/media-response.dto';
export class TweetDto {
  id: string;
  author: AuthorDto;
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
  // TODO media field will be added later

  replyToTweetId: string | null;
  quoteToTweetId: string | null;

  quotedTweet?: TweetDto;
}
