import { TweetDto } from './tweet.dto';

export class GetTweetResponseDto extends TweetDto {
  // Root tweet of the thread (oldes tweet in the chain)
  rootTweet?: TweetDto;

  // Parent tweets leading to this tweet (up to 4)
  // Ordered from oldest to newest
  // Doesn't include the root tweet
  parentTweets?: TweetDto[];

  // Indicates if there are more parent tweets beyond the provided ones
  hasMore?: boolean;
}
