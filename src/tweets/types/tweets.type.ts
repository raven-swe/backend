import { TweetDto } from '../dtos';

export type DeletedTweet = {
  isDeleted: true;
};

export type TweetOrDeleted = TweetDto | DeletedTweet;
