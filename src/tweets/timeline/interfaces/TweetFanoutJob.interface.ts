export interface TweetFanoutJob {
  tweetId: string;
  authorId: string;
  timestamp: number;
}

export interface RetweetFanoutJob extends TweetFanoutJob {
  retweeterId: string;
}
