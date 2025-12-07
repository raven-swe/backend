import { TweetDto } from './tweet.dto';

export class GetTweetResponseDto extends TweetDto {
  replyToTweet?: TweetDto;
}
