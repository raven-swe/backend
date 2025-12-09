import { CompactAuthorDto } from 'src/tweets/dtos/compact-author.dto';
import { CachedStaticTweet } from 'src/tweets/interfaces';

export interface StaticDataFromCache {
  tweets: Map<string, CachedStaticTweet>;
  authors: Map<string, CompactAuthorDto>;
  missingTweetIds: bigint[];
  missingAuthorIds: Set<bigint>;
}
