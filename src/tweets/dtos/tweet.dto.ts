import { TweetEntitiesDto } from './tweet-entitites.dto';
import { AuthorDto } from './author.dto';

export class TweetDto {
  id: string;
  author: AuthorDto;
  //TODO null content will be handled later for media tweets
  content: string;
  createdAt: Date;

  replyCount: number;
  retweetCount: number;
  likeCount: number;

  isLiked: boolean;
  isRetweeted: boolean;

  entities: TweetEntitiesDto;
  media: [];
  // TODO media field will be added later

  replyToTweetId: string | null;
  quoteToTweetId: string | null;

  quotedTweet?: TweetDto;
}
