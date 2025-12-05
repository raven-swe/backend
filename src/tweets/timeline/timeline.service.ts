import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { TweetsRepository } from '../tweets.repository';
import { FeedCursor } from 'src/common/interfaces';
import { decodeCompositeCursor, paginateComposite } from 'src/common/utils';
import {
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_ERROR_CODES,
  PAGINATION_ERROR_MESSAGES,
} from 'src/common/constants';
import { TweetDto, CompactAuthorDto } from '../dtos';
import {
  AUTHOR_COMPACT_DATA_CACHE_TTL,
  LIKE_COUNT_CACHE_TTL,
  RETWEET_COUNT_CACHE_TTL,
  TIMELINE_EMPTY_PLACEHOLDER_TTL,
  TWEET_STATIC_DATA_CACHE_TTL,
} from './constants';
import { StaticDataFromCache } from './interfaces';
import { CachedStaticTweet } from '../interfaces';
import { REDIS_TIMELINE_KEYS } from 'src/common/constants/redis-timeline-keys.constant';
import { DynamicDataFromCache } from './interfaces/DynamicDataFromCache.interface';

@Injectable()
export class TimelineService {
  private readonly logger = new Logger(TimelineService.name);
  private readonly redisClient;

  constructor(
    private readonly redisService: RedisService,
    private readonly tweetsRepository: TweetsRepository,
  ) {
    this.redisClient = redisService.getClient();
  }

  async getTimeline(userId: bigint, cursor: string | undefined, limit: number) {
    this.logger.log(`Fetching following timeline for user ID: ${userId}`);
    let decoded: FeedCursor | undefined;
    if (cursor) {
      try {
        decoded = decodeCompositeCursor<FeedCursor>(cursor);
      } catch {
        throw new HttpException(
          {
            message: PAGINATION_ERROR_MESSAGES.INVALID_CURSOR,
            code: PAGINATION_ERROR_CODES.INVALID_CURSOR,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    let timeline: TweetDto[];
    const timelineKeyExists = await this.redisClient.exists(
      REDIS_TIMELINE_KEYS.getUserTimelineKey(userId),
    );
    if (timelineKeyExists) {
      timeline = await this.timelineCacheHit(userId, decoded, limit + 1);
    } else {
      await this.timelineCacheMiss(userId, decoded);
      timeline = await this.timelineCacheHit(userId, decoded, limit + 1);
    }
    // const validTweets = timeline.filter((tweet) => tweet !== undefined);

    const pagination = paginateComposite(timeline, limit, cursor, (tweet) => ({
      createdAt: tweet.createdAt,
      id: tweet.id.toString(),
    }));
    return {
      items: timeline,
      pagination,
    };
  }

  // reviewer, don't delete these comments please they keep me sane, I will delete them myself (or not)
  // this should be exactly like for you, just the extra step to get the ids from multiple sorted sets instead of one
  // 1 - check the empty placeholder to fail fast (no following tweets, or no interests at all for for you)
  // 2 - get the actual ids (tweets and authors) from redis sorted set (timeline, paginated) (pagination)
  // 3 - hydrate all static data from redis (tweets and authors), get back the missing ones too
  // 4 - backfill the missing ones from db to redis
  // 5 - hydrate dynamic date from redis (likes and retweet counts, and user interactions (user liked or retweeted))
  // 6 - backfill the missing ones from db to redis
  // 7 - now a second pass to get quoted tweet id from the tweets we have (if any)
  // 8 - hydrate these from redis or backfill from db (only the static data is required, no counters or interactions)
  // 9 - assemble and return

  // note: i will filter timeline tweets for people I follow, not muted and accounts are active(i need to reach db for this sadly)
  // why? it's easier that way instead of cleaning the cache on every mute/block/deactivate, the rare case of blocking/muting/deactivating all active people you follow to the point that the timeline becomes short is not worth the extra work

  // keep in mind to create the cuckoo filters lazily (on like or retweet), they persist as long as user acc lives, also invalidating user dto on deactivate and update (another PR after this)

  async timelineCacheHit(
    userId: bigint,
    decodedCursor: FeedCursor | undefined,
    limit: number = PAGINATION_DEFAULT_LIMIT,
  ): Promise<TweetDto[]> {
    // check empty placeholder (to fail fast)
    const isEmpty = await this.redisClient.exists(`timeline:${userId}:empty`);
    if (isEmpty) {
      await this.redisClient.expire(`timeline:${userId}:empty`, TIMELINE_EMPTY_PLACEHOLDER_TTL); // refresh placeholder ttl
      this.logger.log(`Timeline empty placeholder hit for user ID: ${userId}`);
      return [];
    }

    const items = await this.getIdsFromTimelineSet(userId, decodedCursor, limit);
    if (!items || items.length === 0) {
      return [];
    }

    this.logger.log(
      `Hydrating static data for ${items.length} timeline items for user ID: ${userId}`,
    );
    const { tweets, authors, missingTweetIds, missingAuthorIds } =
      await this.hydrateStaticData(items);

    this.logger.log(
      `Backfilling ${missingTweetIds.length} tweets and ${missingAuthorIds.size} authors from DB for user ID: ${userId}`,
    );
    const { tweets: backfilledTweets, authors: backfilledAuthors } =
      await this.backFillStaticDataToCache(missingTweetIds, missingAuthorIds);

    for (const tweet of backfilledTweets) {
      tweets.set(tweet.id, tweet);
    }

    for (const author of backfilledAuthors) {
      authors.set(author.id, author);
    }

    this.logger.log(`Hydrating dynamic data for timeline tweets for user ID: ${userId}`);
    const { likeCounts, retweetCounts, replyCounts, userTweetInteractions } =
      await this.getAndBackfillTweetDynamicData(tweets, userId, missingTweetIds);

    // second pass to hydrate quote tweets ( only static tweet and author, no need for anything else)
    this.logger.log(`Hydrating quoted tweets for timeline tweets for user ID: ${userId}`);
    const quoteTweetIdSet = new Set<string>(); // tweetId -> authorId
    for (const tweet of tweets.values()) {
      if (tweet.quoteToTweetId) {
        quoteTweetIdSet.add(tweet.quoteToTweetId);
      }
    }

    const { tweets: quoteTweetsMap, authors: quoteAuthorsMap } = await this.hydrateStaticQuoteData(
      Array.from(quoteTweetIdSet),
    );

    // add to main maps
    for (const [tweetId, tweet] of quoteTweetsMap.entries()) {
      tweets.set(tweetId, tweet);
    }

    for (const [authorId, author] of quoteAuthorsMap.entries()) {
      authors.set(authorId, author);
    }

    // final assembly
    return this.assembleTimelineTweets(items, tweets, authors, {
      likeCounts,
      retweetCounts,
      replyCounts,
      userTweetInteractions,
    });
  }

  private async getIdsFromTimelineSet(
    userId: bigint,
    decodedCursor: FeedCursor | undefined,
    limit: number,
  ): Promise<string[]> {
    // paginated ids
    const timelineKey = REDIS_TIMELINE_KEYS.getUserTimelineKey(userId);
    const maxScore = decodedCursor ? new Date(decodedCursor.createdAt).getTime() : '+inf';

    const items = await this.redisClient.zrevrangebyscore(
      timelineKey,
      maxScore,
      '-inf',
      'LIMIT',
      0,
      limit,
    );

    if (!items || items.length === 0) {
      await this.redisClient.setex(
        REDIS_TIMELINE_KEYS.getUserTimelineEmptyPlaceholderKey(userId),
        TIMELINE_EMPTY_PLACEHOLDER_TTL,
        '1',
      ); // set the empty placeholder
      this.logger.log(
        `No timeline items found in cache for user ID: ${userId}, setting empty placeholder`,
      );
    }

    return items;
  }

  /**
   * This functions takes an array of timeline items (strings "authorId:tweetId") and
   * attemps to hydrate their static data (tweet without counts and interactions, and author) from cache.
   * It finally returns the hydrated data along with the missing ids to be backfilled from DB.
   * @param items Array of strings "tweetId:authorId" taken from timeline caches
   * @returns StaticDataFromCache object containing maps of hydrated tweets and authors, and arrays of missing tweet and author IDs
   */
  private async hydrateStaticData(items: string[]): Promise<StaticDataFromCache> {
    const tweetIds = new Array<bigint>();
    const authorIds = new Array<bigint>();
    const tweetsMap = new Map<string, CachedStaticTweet>();
    const authorsMap = new Map<string, CompactAuthorDto>();
    const missingTweetIds = new Array<bigint>();
    const missingAuthorIds = new Set<bigint>();

    const hydrationPipeline = this.redisClient.pipeline();

    for (const item of items) {
      const [authorIdStr, tweetIdStr] = item.split(':');
      tweetIds.push(BigInt(tweetIdStr));
      hydrationPipeline.getex(
        REDIS_TIMELINE_KEYS.getTweetStaticDataKey(BigInt(tweetIdStr)),
        'EX',
        TWEET_STATIC_DATA_CACHE_TTL,
      );
      authorIds.push(BigInt(authorIdStr));
      hydrationPipeline.getex(
        REDIS_TIMELINE_KEYS.getAuthorDataKey(BigInt(authorIdStr)),
        'EX',
        AUTHOR_COMPACT_DATA_CACHE_TTL,
      );
    }

    const hydrationResults = await hydrationPipeline.exec();

    if (hydrationResults === null) {
      // the case that triggers a null return NEVER happens, but for type safety
      return {
        tweets: tweetsMap,
        authors: authorsMap,
        missingTweetIds,
        missingAuthorIds,
      };
    }

    // hydration returns a [error, result] tuple for each command, so each pair of those is a tweet and author
    for (let i = 0; i < hydrationResults.length; i += 2) {
      const [[tweetErr, tweetData], [authorErr, authorData]] = [
        hydrationResults[i],
        hydrationResults[i + 1],
      ];

      if (tweetErr || authorErr) {
        if (tweetErr) missingTweetIds.push(tweetIds[i / 2]);
        if (authorErr) missingAuthorIds.add(authorIds[i / 2]); // to be hydrated from DB
        if (tweetErr && authorErr) continue;
      }

      if (tweetData && typeof tweetData === 'string') {
        const tweet: CachedStaticTweet = JSON.parse(tweetData) as CachedStaticTweet;
        tweetsMap.set(tweetIds[i / 2].toString(), tweet);
      } else {
        missingTweetIds.push(tweetIds[i / 2]);
      }

      if (authorData && typeof authorData === 'string') {
        const authorDto: CompactAuthorDto = JSON.parse(authorData) as CompactAuthorDto;
        authorsMap.set(authorIds[i / 2].toString(), authorDto);
      } else {
        missingAuthorIds.add(authorIds[i / 2]);
      }
    }

    this.logger.log(
      `Hydrated ${tweetsMap.size} tweets and ${authorsMap.size} authors from cache, missing ${missingTweetIds.length} tweets and ${missingAuthorIds.size} authors to backfill from DB`,
    );

    return {
      tweets: tweetsMap,
      authors: authorsMap,
      missingTweetIds,
      missingAuthorIds,
    };
  }

  /**
   * This fetches the missing static data (tweets and authors) from DB and backfills them to redis cache
   * @param missingTweetIds
   * @param missingAuthorIds
   * @returns Array of tweets and authors
   */
  async backFillStaticDataToCache(
    missingTweetIds: bigint[],
    missingAuthorIds: Set<bigint>,
  ): Promise<{
    tweets: CachedStaticTweet[];
    authors: CompactAuthorDto[];
  }> {
    if (missingTweetIds.length === 0 && missingAuthorIds.size === 0) {
      return {
        tweets: [],
        authors: [],
      };
    }

    const [tweets, authors] = await Promise.all([
      this.tweetsRepository.getTweetsByIds(missingTweetIds),
      this.tweetsRepository.getCompactAuthorsByIds(missingAuthorIds),
    ]);

    const backfillPipeline = this.redisClient.pipeline();

    for (const tweet of tweets) {
      backfillPipeline.set(
        REDIS_TIMELINE_KEYS.getTweetStaticDataKey(BigInt(tweet.id)),
        JSON.stringify(tweet),
        'EX',
        TWEET_STATIC_DATA_CACHE_TTL,
      );
    }

    for (const author of authors) {
      backfillPipeline.set(
        REDIS_TIMELINE_KEYS.getAuthorDataKey(BigInt(author.id)),
        JSON.stringify(author),
        'EX',
        AUTHOR_COMPACT_DATA_CACHE_TTL,
      );
    }

    await backfillPipeline.exec();

    return {
      tweets,
      authors,
    };
  }

  /**
   *
   * @param tweets The fetched tweets, we use the counts from those to backfill the counter cache if expired
   * @param userId
   * @param missingTweetIds The tweet ids we backfilled from the database, for these we have to explicitly check the counts, and backfill from db if expired
   * @returns A DynamicDataFromCache object, having the counters for a tweet, and if the user liked/retweeted it
   */
  async getAndBackfillTweetDynamicData(
    tweets: Map<string, CachedStaticTweet>,
    userId: bigint,
    missingTweetIds: bigint[],
  ): Promise<DynamicDataFromCache> {
    const likeCountsMap = new Map<bigint, number>();
    const retweetCountsMap = new Map<bigint, number>();
    const replyCountsMap = new Map<bigint, number>();

    const missingLikeCounts = new Array<bigint>();
    const missingRetweetCounts = new Array<bigint>();
    const missingReplyCounts = new Array<bigint>();
    const missingUserInteractionsMap = new Map<bigint, { liked: boolean; retweeted: boolean }>();

    const dynamicDataPipeline = this.redisClient.pipeline();

    for (const tweetId of missingTweetIds) {
      dynamicDataPipeline.getex(
        REDIS_TIMELINE_KEYS.getTweetLikesCountKey(tweetId),
        'EX',
        LIKE_COUNT_CACHE_TTL,
      );
      dynamicDataPipeline.getex(
        REDIS_TIMELINE_KEYS.getTweetRetweetsCountKey(tweetId),
        'EX',
        RETWEET_COUNT_CACHE_TTL,
      );
      dynamicDataPipeline.getex(
        REDIS_TIMELINE_KEYS.getTweetRepliesCountKey(tweetId),
        'EX',
        RETWEET_COUNT_CACHE_TTL,
      );
    }

    const tweetIds = Array.from(tweets.keys()).map((idStr) => BigInt(idStr));
    for (const tweetId of tweetIds) {
      dynamicDataPipeline.call(
        'CF.EXISTS',
        REDIS_TIMELINE_KEYS.getUserInteractionsKey(userId),
        REDIS_TIMELINE_KEYS.getUserInteractionsLikeItem(tweetId),
      );
      dynamicDataPipeline.call(
        'CF.EXISTS',
        REDIS_TIMELINE_KEYS.getUserInteractionsKey(userId),
        REDIS_TIMELINE_KEYS.getUserInteractionsRetweetItem(tweetId),
      );
    }

    const dynamicDataResults = await dynamicDataPipeline.exec();

    if (dynamicDataResults === null) {
      // the case that triggers a null return NEVER happens, but for type safety
      return {
        likeCounts: likeCountsMap,
        retweetCounts: retweetCountsMap,
        replyCounts: replyCountsMap,
        userTweetInteractions: new Map<bigint, { liked: boolean; retweeted: boolean }>(),
      };
    }

    // process counts
    for (let i = 0; i < missingTweetIds.length; i++) {
      const [[likeErr, likeData], [retweetErr, retweetData], [replyErr, replyData]] = [
        dynamicDataResults[i * 3],
        dynamicDataResults[i * 3 + 1],
        dynamicDataResults[i * 3 + 2],
      ];

      const tweetId = missingTweetIds[i];

      if (likeErr || retweetErr || replyErr) {
        if (likeErr) missingLikeCounts.push(tweetId);
        if (retweetErr) missingRetweetCounts.push(tweetId);
        if (replyErr) missingReplyCounts.push(tweetId);
        if (likeErr && retweetErr) continue;
      }

      if (likeData !== null) {
        likeCountsMap.set(tweetId, Number(likeData));
      }

      if (retweetData !== null) {
        retweetCountsMap.set(tweetId, Number(retweetData));
      }

      if (replyData !== null) {
        replyCountsMap.set(tweetId, Number(replyData));
      }
    }

    this.logger.log(
      `Hydrated dynamic counts for ${likeCountsMap.size} likes, ${retweetCountsMap.size} retweets, and ${replyCountsMap.size} replies from cache for user ID: ${userId}, and missing counts - ${missingLikeCounts.length} likes, ${missingRetweetCounts.length} retweets, ${missingReplyCounts.length} replies`,
    );

    // interactions (they all miss now, I might keep it likes this actually as it's fast enough)
    const interactionsOffset = missingTweetIds.length * 3;
    for (let i = interactionsOffset; i < tweetIds.length; i += 2) {
      const [[likeErr, likeData], [retweetErr, retweetData]] = [
        dynamicDataResults[i],
        dynamicDataResults[i + 1],
      ];

      const tweetId = tweetIds[(i - interactionsOffset) / 2];

      if (likeErr || likeData == 1) {
        // if not found OR "probably yes"
        const existing = missingUserInteractionsMap.get(tweetId) || {
          liked: false,
          retweeted: false,
        };
        missingUserInteractionsMap.set(tweetId, { ...existing, liked: true });
      }

      if (retweetErr || retweetData == 1) {
        // if not found OR "probably yes"
        const existing = missingUserInteractionsMap.get(tweetId) || {
          liked: false,
          retweeted: false,
        };
        missingUserInteractionsMap.set(tweetId, { ...existing, retweeted: true });
      }
    }
    const missingInteractionLikes = new Array<bigint>();
    const missingInteractionRetweets = new Array<bigint>();
    for (const [tweetId, interaction] of missingUserInteractionsMap.entries()) {
      if (interaction.liked) {
        missingInteractionLikes.push(tweetId);
      }
      if (interaction.retweeted) {
        missingInteractionRetweets.push(tweetId);
      }
    }

    const { likeCounts, retweetCounts, replyCounts, userTweetInteractions }: DynamicDataFromCache =
      await this.tweetsRepository.getTweetDynamicDataForUser(
        missingLikeCounts,
        missingRetweetCounts,
        missingReplyCounts,
        missingInteractionLikes,
        missingInteractionRetweets,
        userId,
      );

    // backfill the caches for the counts we got from DB (interactions are handled by the cuckoo filter, no need to backfill)
    await this.backfillDynamicDataToCache(
      likeCounts,
      retweetCounts,
      replyCounts,
      likeCountsMap,
      retweetCountsMap,
      replyCountsMap,
    );

    return {
      likeCounts: likeCountsMap,
      retweetCounts: retweetCountsMap,
      replyCounts: replyCountsMap,
      userTweetInteractions,
    };
  }

  /**
   * This backfills multiple dynamic data entries to cache at once, from likeCounts, retweetCounts, replyCounts maps
   * It also updates the complete maps with these counts, having the complete data (either already cached or after backfill)
   * @param likeCounts
   * @param retweetCounts
   * @param replyCounts
   * @param likeCountsMap
   * @param retweetCountsMap
   * @param replyCountsMap
   * @returns void
   */
  async backfillDynamicDataToCache(
    likeCounts: Map<bigint, number>,
    retweetCounts: Map<bigint, number>,
    replyCounts: Map<bigint, number>,
    likeCountsMap: Map<bigint, number>,
    retweetCountsMap: Map<bigint, number>,
    replyCountsMap: Map<bigint, number>,
  ): Promise<void> {
    const backfillPipeline = this.redisClient.pipeline();

    for (const [tweetId, count] of likeCounts.entries()) {
      likeCountsMap.set(tweetId, count);
      backfillPipeline.set(
        REDIS_TIMELINE_KEYS.getTweetLikesCountKey(tweetId),
        count.toString(),
        'EX',
        LIKE_COUNT_CACHE_TTL,
      );
    }

    for (const [tweetId, count] of retweetCounts.entries()) {
      retweetCountsMap.set(tweetId, count);
      backfillPipeline.set(
        REDIS_TIMELINE_KEYS.getTweetRetweetsCountKey(tweetId),
        count.toString(),
        'EX',
        RETWEET_COUNT_CACHE_TTL,
      );
    }

    for (const [tweetId, count] of replyCounts.entries()) {
      replyCountsMap.set(tweetId, count);
      backfillPipeline.set(
        REDIS_TIMELINE_KEYS.getTweetRepliesCountKey(tweetId),
        count.toString(),
        'EX',
        RETWEET_COUNT_CACHE_TTL,
      );
    }

    await backfillPipeline.exec();
  }

  /**
   * This is a separate function from hydrateStaticData because we don't have the author ids for quotes, so it's simpler to split
   * @param quoteTweetIds
   */
  async hydrateStaticQuoteData(quoteTweetIds: string[]): Promise<{
    tweets: Map<string, CachedStaticTweet>;
    authors: Map<string, CompactAuthorDto>;
  }> {
    const tweetsMap = new Map<string, CachedStaticTweet>();
    const authorMap = new Map<string, CompactAuthorDto>();
    const authorIds = new Array<bigint>();
    const missingTweetIds = new Array<bigint>();

    const hydrationPipeline = this.redisClient.pipeline();
    for (const tweetIdStr of quoteTweetIds) {
      const tweetId = BigInt(tweetIdStr);
      hydrationPipeline.getex(
        REDIS_TIMELINE_KEYS.getTweetStaticDataKey(tweetId),
        'EX',
        TWEET_STATIC_DATA_CACHE_TTL,
      );
    }

    const hydrationResults = await hydrationPipeline.exec();

    if (hydrationResults === null) {
      // the case that triggers a null return NEVER happens, but for type safety
      return {
        tweets: tweetsMap,
        authors: authorMap,
      };
    }

    for (let i = 0; i < hydrationResults.length; i++) {
      const [tweetErr, tweetData] = hydrationResults[i];
      const tweetIdStr = quoteTweetIds[i];
      const tweetIdBigInt = BigInt(tweetIdStr);

      if (tweetErr) {
        missingTweetIds.push(tweetIdBigInt);
        continue;
      }

      if (tweetData && typeof tweetData === 'string') {
        const tweet: CachedStaticTweet = JSON.parse(tweetData) as CachedStaticTweet;
        tweetsMap.set(tweetIdStr, tweet);
        authorIds.push(BigInt(tweet.authorId));
      } else {
        missingTweetIds.push(tweetIdBigInt);
      }
    }

    this.logger.log(
      `Hydrated ${tweetsMap.size} quoted tweets from cache, missing ${missingTweetIds.length} quotes to backfill from DB`,
    );

    // get missing tweets from DB
    const missingTweets = await this.tweetsRepository.getTweetsByIds(missingTweetIds);
    const backfillPipeline = this.redisClient.pipeline();

    for (const tweet of missingTweets) {
      tweetsMap.set(tweet.id, tweet);
      backfillPipeline.set(
        REDIS_TIMELINE_KEYS.getTweetStaticDataKey(BigInt(tweet.id)),
        JSON.stringify(tweet),
        'EX',
        TWEET_STATIC_DATA_CACHE_TTL,
      );
      authorIds.push(BigInt(tweet.authorId));
    }

    // hydrate authors
    this.logger.log(`Hydrating ${authorIds.length} authors for quoted tweets from cache`);
    const authorsHydrationPipeline = this.redisClient.pipeline();
    for (const authorId of authorIds) {
      authorsHydrationPipeline.getex(
        REDIS_TIMELINE_KEYS.getAuthorDataKey(authorId),
        'EX',
        AUTHOR_COMPACT_DATA_CACHE_TTL,
      );
    }

    const authorsHydrationResults = await authorsHydrationPipeline.exec();
    const missingAuthorIds = new Set<bigint>();

    if (authorsHydrationResults === null) {
      return {
        tweets: tweetsMap,
        authors: authorMap,
      };
    }

    for (let i = 0; i < authorsHydrationResults.length; i++) {
      const [authorErr, authorData] = authorsHydrationResults[i];
      const authorId = authorIds[i];

      if (authorErr) {
        missingAuthorIds.add(authorId);
        continue;
      }

      if (authorData && typeof authorData === 'string') {
        const authorDto: CompactAuthorDto = JSON.parse(authorData) as CompactAuthorDto;
        authorMap.set(authorId.toString(), authorDto);
      } else {
        missingAuthorIds.add(authorId);
      }
    }

    this.logger.log(
      `Hydrated ${authorMap.size} authors for quoted tweets from cache, missing ${missingAuthorIds.size} authors to backfill from DB`,
    );
    // get missing authors from DB
    const missingAuthors = await this.tweetsRepository.getCompactAuthorsByIds(missingAuthorIds);

    for (const author of missingAuthors) {
      authorMap.set(author.id, author);
      backfillPipeline.set(
        REDIS_TIMELINE_KEYS.getAuthorDataKey(BigInt(author.id)),
        JSON.stringify(author),
        'EX',
        AUTHOR_COMPACT_DATA_CACHE_TTL,
      );
    }

    await backfillPipeline.exec();

    return {
      tweets: tweetsMap,
      authors: authorMap,
    };
  }

  /**
   * Final step function of a timeline cache hit, it takes the items string array from timeline to maintain order, the actual tweets and author maps, and the dynamic data (likes, retweets, replies counts, and user interactions)
   * @param items The array of timeline items (strings "authorId:tweetId") to maintain order
   * @param tweets The map of tweets hydrated from cache and backfilled from DB
   * @param authors The map of authors hydrated from cache and backfilled from DB
   * @param dynamicData The dynamic data from cache and backfilled from DB
   * @returns Array of TweetDto ready to be returned to the user
   */
  assembleTimelineTweets(
    items: string[],
    tweets: Map<string, CachedStaticTweet>,
    authors: Map<string, CompactAuthorDto>,
    dynamicData: DynamicDataFromCache,
  ): TweetDto[] {
    const timelineTweets = new Array<TweetDto>();

    for (const item of items) {
      const [authorIdStr, tweetIdStr] = item.split(':');
      const tweet = tweets.get(tweetIdStr);
      const author = authors.get(authorIdStr);

      if (!tweet || !author) {
        continue; // never happens
      }

      const likeCount = dynamicData.likeCounts.get(BigInt(tweetIdStr)) ?? 0;
      const retweetCount = dynamicData.retweetCounts.get(BigInt(tweetIdStr)) ?? 0;
      const replyCount = dynamicData.replyCounts.get(BigInt(tweetIdStr)) ?? 0;

      const userInteractions = dynamicData.userTweetInteractions.get(BigInt(tweetIdStr));

      const isLiked = userInteractions ? userInteractions.liked : false;
      const isRetweeted = userInteractions ? userInteractions.retweeted : false;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { authorId, ...tweetWithoutAuthorId } = tweet; // remove authorId from tweet
      const tweetDto: TweetDto = {
        ...tweetWithoutAuthorId,
        author,
        likeCount,
        retweetCount,
        replyCount,
        isLiked,
        isRetweeted,
      };

      timelineTweets.push(tweetDto);
    }

    // now quotes
    for (const tweet of timelineTweets) {
      if (tweet.quoteToTweetId) {
        const quotedTweet = tweets.get(tweet.quoteToTweetId);
        if (quotedTweet) {
          const quotedAuthor = authors.get(quotedTweet.authorId);
          if (quotedAuthor) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { authorId, ...quotedTweetWithoutAuthorId } = quotedTweet;
            tweet.quotedTweet = {
              ...quotedTweetWithoutAuthorId,
              author: quotedAuthor,
              likeCount: 0, // these are not needed at all
              replyCount: 0,
              retweetCount: 0,
              isLiked: false,
              isRetweeted: false,
            };
          }
        }
      }
    }
    return timelineTweets;
  }

  async timelineCacheMiss(userId: bigint, decodedCursor: FeedCursor | undefined): Promise<void> {
    this.logger.log(`Timeline cache miss for user ID: ${userId}, fetching from DB`);

    // Get the complete timeline from database
    const tweets = await this.tweetsRepository.getTimelineForUser(userId, decodedCursor, undefined);

    if (!tweets || tweets.length === 0) {
      // Set empty placeholder to avoid repeated DB hits
      await this.redisClient.setex(
        REDIS_TIMELINE_KEYS.getUserTimelineEmptyPlaceholderKey(userId),
        TIMELINE_EMPTY_PLACEHOLDER_TTL,
        '1',
      );
      this.logger.log(`No tweets found for user ID: ${userId}, setting empty placeholder`);
      return;
    }

    this.logger.log(
      `Fetched ${tweets.length} tweets from DB for user ID: ${userId}, populating cache`,
    );

    // Populate timeline cache with scored set (using createdAt as score)
    const timelineKey = REDIS_TIMELINE_KEYS.getUserTimelineKey(userId);
    const timelinePipeline = this.redisClient.pipeline();

    const tweetAuthors = new Set<bigint>();
    const tweetIds = new Array<bigint>();

    for (const tweet of tweets) {
      const score = tweet.createdAt.getTime();
      const member = `${tweet.author.id}:${tweet.id}`;
      timelinePipeline.zadd(timelineKey, score, member);

      tweetIds.push(BigInt(tweet.id));
      tweetAuthors.add(BigInt(tweet.author.id));

      // Handle quoted tweets
      if (tweet.quotedTweet) {
        tweetIds.push(BigInt(tweet.quotedTweet.id));
        tweetAuthors.add(BigInt(tweet.quotedTweet.author.id));
      }
    }

    // Set timeline TTL
    timelinePipeline.expire(timelineKey, TIMELINE_EMPTY_PLACEHOLDER_TTL);
    await timelinePipeline.exec();
  }
}
