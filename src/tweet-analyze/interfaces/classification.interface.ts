export interface TweetToClassify {
  id: string;
  content: string;
}

export interface ModelApiRequest {
  tweets: TweetToClassify[];
}

export interface ClassifiedTweet {
  id: string;
  class: string;
}

export interface ModelTopic {
  topic: string;
  trend_score: number;
  occurence_in_category: number;
}

export interface TrendingKeyword {
  keyword: string;
  general_trend_score: number;
  top_related_topics: ModelTopic[];
}

export interface BatchMeta {
  total_tweets: number;
}

export interface ModelApiResponse {
  batch_meta: BatchMeta;
  trending_keywords: TrendingKeyword[];
  tweets_detail: ClassifiedTweet[];
}
