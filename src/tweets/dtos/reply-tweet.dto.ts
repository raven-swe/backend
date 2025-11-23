import { TweetDto } from './tweet.dto';

export type ReplyTweetDto = Omit<TweetDto, 'quotedTweet' | 'quoteToTweetId'>;
