import { Exclude } from 'class-transformer';
import { TweetDto } from './tweet.dto';

export class GetTweetResponseDto extends TweetDto {
  replyToTweet?: TweetDto;

  @Exclude()
  rank?: number;
}
