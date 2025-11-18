import { TweetEntitiesDto } from './tweet-entitites.dto';
import { AuthorDto } from './author.dto';
import { MediaDto } from 'src/media/dtos';

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
  media: MediaDto[];
  // TODO media field will be added later

  replyToTweetId: string | null;
  quoteToTweetId: string | null;

  quotedTweet?: TweetDto;
}
