export interface TweetToClassify {
  id: string;
  content: string;
}

export interface ClassificationRequest {
  tweets: TweetToClassify[];
}

export interface ClassifiedTweet {
  id: string;
  class: string;
}

export interface ClassificationResponse {
  tweets_detail: ClassifiedTweet[];
}
