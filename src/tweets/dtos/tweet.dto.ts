import { TweetEntitiesDto } from './tweet-entitites.dto';
import { MediaResponseDto } from 'src/media/dtos/media-response.dto';
import { DeletedTweet } from '../types';
import { AuthorDto } from './author.dto';

export class TweetDto {
  id: string;
  author: AuthorDto;
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
  rootTweetId: string | null;

  quotedTweet?: TweetDto | DeletedTweet;

  repostedBy?: Retweeter;
}

type Retweeter = Omit<AuthorDto, 'relationship' | 'avatarUrl'> & {
  id: string;
};
