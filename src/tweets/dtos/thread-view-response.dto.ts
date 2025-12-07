import { TweetOrDeleted } from '../types';
import { TweetDto } from './tweet.dto';

export class ThreadViewResponseDto extends TweetDto {
  // Root tweet of the thread (oldes tweet in the chain)
  rootTweet: TweetOrDeleted | null;

  // Parent tweets leading to this tweet (up to 4)
  // Ordered from oldest to newest
  // Doesn't include the root tweet
  parentTweets: TweetOrDeleted[];

  // Indicates if there are more parent tweets beyond the provided ones
  hasMoreParents: boolean;
}
