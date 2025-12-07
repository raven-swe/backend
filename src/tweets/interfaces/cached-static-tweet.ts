import { TweetDto } from '../dtos';

export type CachedStaticTweet = Omit<
  TweetDto,
  'author' | 'isLiked' | 'isRetweeted' | 'quotedTweet' | 'replyCount' | 'retweetCount' | 'likeCount'
> & {
  authorId: string;
};
