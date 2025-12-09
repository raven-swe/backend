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
import { TweetDto, CompactAuthorWithId } from '../dtos';
import {
  AUTHOR_COMPACT_DATA_CACHE_TTL,
  LIKE_COUNT_CACHE_TTL,
  REPLIES_COUNT_CACHE_TTL,
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
    this.logger.debug(`Fetching following timeline for user ID: ${userId}`);
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
      // empty placeholder avoids the query on a cache miss, this gets removed on fanout of any new tweet/retweet
      if (
        await this.redisClient.exists(
          REDIS_TIMELINE_KEYS.getUserTimelineEmptyPlaceholderKey(userId),
        )
      ) {
        timeline = [];
      } else {
        await this.timelineCacheMiss(userId, decoded);
        timeline = await this.timelineCacheHit(userId, decoded, limit + 1);
      }
    }

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

  // TODO invalidating user dto on deactivate and update (another PR after this), and counter updates

  //not the best, send authorids to be checked for unfollow/mute, and send the tweetids to check for deleted/deactivated accounts to fitler
  // this while getting more keys to ensure a full page after filtering

  // i will remove retweets on write because retweet removal is not read-time filterable
  // this is inconsistency I know, but yeah, irl the fanout would be only for nonpower users, so purging would be a better appraoch for a cleaner cache
  async timelineCacheHit(
    userId: bigint,
    decodedCursor: FeedCursor | undefined,
    limit: number = PAGINATION_DEFAULT_LIMIT,
  ): Promise<TweetDto[]> {
    const isEmpty = await this.redisClient.exists(`timeline:${userId}:empty`);
    if (isEmpty) {
      await this.redisClient.expire(`timeline:${userId}:empty`, TIMELINE_EMPTY_PLACEHOLDER_TTL);
      this.logger.debug(`Timeline empty placeholder hit for user ID: ${userId}`);
      return [];
    }

    const validTweets: TweetDto[] = [];
    let currentCursor = decodedCursor;
    const batchSize = limit * 2;
    const maxAttempts = 5;
    let attempts = 0;

    while (validTweets.length < limit && attempts < maxAttempts) {
      attempts++;

      const timelineObjects = await this.getIdsFromTimelineSet(userId, currentCursor, batchSize);
      if (!timelineObjects || timelineObjects.length === 0) {
        break;
      }

      const { authorIds, tweetIds } = this.extractIdsFromTimelineItems(timelineObjects);

      const [validAuthorIds, validTweetIds] = await Promise.all([
        this.tweetsRepository.filterValidAuthors(userId, Array.from(authorIds)),
        this.tweetsRepository.filterValidTweets(Array.from(tweetIds)),
      ]);

      const validAuthorSet = new Set(validAuthorIds.map((id) => id.toString()));
      const validTweetSet = new Set(validTweetIds.map((id) => id.toString()));

      const filteredItems = timelineObjects.filter((item) => {
        const [authorId, tweetId, actionType, retweeterId] = item.split(':');
        const isTweetValid = validTweetSet.has(tweetId);
        const isAuthorValid = validAuthorSet.has(authorId);
        const isRetweeterValid =
          actionType === 'R' && retweeterId ? validAuthorSet.has(retweeterId) : true;

        return isTweetValid && isAuthorValid && isRetweeterValid;
      });

      const uniqueFilteredTimelineObjects = this.deduplicateTimelineItems(filteredItems);

      this.logger.debug(
        `Filtered ${timelineObjects.length - filteredItems.length} items (muted/unfollowed/deleted) for user ID: ${userId}, remaining: ${filteredItems.length}`,
      );

      if (uniqueFilteredTimelineObjects.length > 0) {
        this.logger.debug(
          `Hydrating static data for ${uniqueFilteredTimelineObjects.length} timeline items for user ID: ${userId}`,
        );

        const { tweets, authors, missingTweetIds, missingAuthorIds } = await this.hydrateStaticData(
          uniqueFilteredTimelineObjects,
        );

        this.logger.debug(
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

        this.logger.debug(`Hydrating dynamic data for timeline tweets for user ID: ${userId}`);
        const { likeCounts, retweetCounts, replyCounts, userTweetInteractions } =
          await this.getAndBackfillTweetDynamicData(tweets, userId);

        this.logger.debug(`Hydrating quoted tweets for timeline tweets for user ID: ${userId}`);
        const quoteTweetIdSet = new Set<string>();
        for (const tweet of tweets.values()) {
          if (tweet.quoteToTweetId) {
            quoteTweetIdSet.add(tweet.quoteToTweetId);
          }
        }

        const { tweets: quoteTweetsMap, authors: quoteAuthorsMap } =
          await this.hydrateStaticQuoteData(Array.from(quoteTweetIdSet));

        for (const [tweetId, tweet] of quoteTweetsMap.entries()) {
          tweets.set(tweetId, tweet);
        }

        for (const [authorId, author] of quoteAuthorsMap.entries()) {
          authors.set(authorId, author);
        }

        const batchTweets = this.assembleTimelineTweets(
          uniqueFilteredTimelineObjects,
          tweets,
          authors,
          {
            likeCounts,
            retweetCounts,
            replyCounts,
            userTweetInteractions,
          },
        );

        validTweets.push(...batchTweets);
      }

      if (validTweets.length < limit && timelineObjects.length === batchSize) {
        const lastItem = timelineObjects[timelineObjects.length - 1]; // sets cursor to last item FROM REDIS NOT THE FILTERED ONES
        const lastTweetCreatedAt = await this.getTweetCreatedAt(userId, lastItem);
        const [, lastTweetId] = lastItem.split(':');
        currentCursor = lastTweetCreatedAt
          ? {
              createdAt: lastTweetCreatedAt,
              id: lastTweetId,
            }
          : undefined;
      } else {
        break;
      }
    }

    return validTweets.slice(0, limit);
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
      this.logger.debug(
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
    const authorsMap = new Map<string, CompactAuthorWithId>();
    const missingTweetIds = new Array<bigint>();
    const missingAuthorIds = new Set<bigint>();

    // needed because some tweets can be retweets, so redis can return either [tweetErr, tweetData] and [authorErr, authorData] for tweets, an additional [retweeterErr, retweeterData] in case of retweet
    const itemStructure = Array<{ tweetId: bigint; authorId: bigint; retweeterId?: bigint }>();

    const hydrationPipeline = this.redisClient.pipeline();

    for (const item of items) {
      const [authorId, tweetId, actionType, retweeterId] = item.split(':');

      tweetIds.push(BigInt(tweetId));
      hydrationPipeline.getex(
        REDIS_TIMELINE_KEYS.getTweetStaticDataKey(BigInt(tweetId)),
        'EX',
        TWEET_STATIC_DATA_CACHE_TTL,
      );

      authorIds.push(BigInt(authorId));
      hydrationPipeline.getex(
        REDIS_TIMELINE_KEYS.getAuthorDataKey(BigInt(authorId)),
        'EX',
        AUTHOR_COMPACT_DATA_CACHE_TTL,
      );

      const itemInfo: { tweetId: bigint; authorId: bigint; retweeterId?: bigint } = {
        tweetId: BigInt(tweetId),
        authorId: BigInt(authorId),
      };
      // retweeter is a normal author to the cache
      if (actionType === 'R' && retweeterId) {
        authorIds.push(BigInt(retweeterId));
        hydrationPipeline.getex(
          REDIS_TIMELINE_KEYS.getAuthorDataKey(BigInt(retweeterId)),
          'EX',
          AUTHOR_COMPACT_DATA_CACHE_TTL,
        );
        itemInfo.retweeterId = BigInt(retweeterId);
      }

      itemStructure.push(itemInfo);
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
    let resultIndex = 0;
    for (const itemInfo of itemStructure) {
      // tweet is always present
      const [tweetErr, tweetData] = hydrationResults[resultIndex++];
      if (tweetErr || tweetData === null) {
        missingTweetIds.push(itemInfo.tweetId);
      } else if (typeof tweetData === 'string') {
        const tweet: CachedStaticTweet = JSON.parse(tweetData) as CachedStaticTweet;
        tweetsMap.set(itemInfo.tweetId.toString(), tweet);
      }

      // author is always present
      const [authorErr, authorData] = hydrationResults[resultIndex++];
      if (authorErr || authorData === null) {
        missingAuthorIds.add(itemInfo.authorId);
      } else if (typeof authorData === 'string') {
        const authorDto: CompactAuthorWithId = JSON.parse(authorData) as CompactAuthorWithId;
        authorsMap.set(itemInfo.authorId.toString(), authorDto);
      }

      // retweeter author if present
      if (itemInfo.retweeterId) {
        const [retweeterErr, retweeterData] = hydrationResults[resultIndex++];
        if (retweeterErr || retweeterData === null) {
          missingAuthorIds.add(itemInfo.retweeterId);
        } else if (typeof retweeterData === 'string') {
          const retweeterDto: CompactAuthorWithId = JSON.parse(
            retweeterData,
          ) as CompactAuthorWithId;
          authorsMap.set(itemInfo.retweeterId.toString(), retweeterDto);
        }
      }
    }

    this.logger.debug(
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
    authors: CompactAuthorWithId[];
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
   * @param tweets
   * @param userId
   * @returns A DynamicDataFromCache object, having the counters for a tweet, and if the user liked/retweeted it
   */
  async getAndBackfillTweetDynamicData(
    tweets: Map<string, CachedStaticTweet>,
    userId: bigint,
  ): Promise<DynamicDataFromCache> {
    const tweetIds = Array.from(tweets.keys()).map((idStr) => BigInt(idStr));
    const likeCountsMap = new Map<bigint, number>();
    const retweetCountsMap = new Map<bigint, number>();
    const replyCountsMap = new Map<bigint, number>();

    const missingLikeCounts = new Array<bigint>();
    const missingRetweetCounts = new Array<bigint>();
    const missingReplyCounts = new Array<bigint>();

    const dynamicDataPipeline = this.redisClient.pipeline();

    for (const tweetId of tweetIds) {
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
        REPLIES_COUNT_CACHE_TTL,
      );
    }

    const dynamicDataResults = await dynamicDataPipeline.exec();

    if (dynamicDataResults === null) {
      // the case that triggers a null return NEVER happens, but for type safety
      return {
        likeCounts: likeCountsMap,
        retweetCounts: retweetCountsMap,
        replyCounts: replyCountsMap,
        userTweetInteractions: new Map<bigint, { isLiked: boolean; isRetweeted: boolean }>(),
      };
    }

    // process counts
    for (let i = 0; i < tweetIds.length; i++) {
      const [[likeErr, likeData], [retweetErr, retweetData], [replyErr, replyData]] = [
        dynamicDataResults[i * 3],
        dynamicDataResults[i * 3 + 1],
        dynamicDataResults[i * 3 + 2],
      ];

      const tweetId = tweetIds[i];

      if (likeErr || likeData === null) {
        missingLikeCounts.push(tweetId);
      } else {
        likeCountsMap.set(tweetId, Number(likeData));
      }

      if (retweetErr || retweetData === null) {
        missingRetweetCounts.push(tweetId);
      } else {
        retweetCountsMap.set(tweetId, Number(retweetData));
      }

      if (replyErr || replyData === null) {
        missingReplyCounts.push(tweetId);
      } else {
        replyCountsMap.set(tweetId, Number(replyData));
      }
    }

    this.logger.debug(
      `Hydrated dynamic counts for ${likeCountsMap.size} likes, ${retweetCountsMap.size} retweets, and ${replyCountsMap.size} replies from cache for user ID: ${userId}, and missing counts - ${missingLikeCounts.length} likes, ${missingRetweetCounts.length} retweets, ${missingReplyCounts.length} replies`,
    );

    // backfill the caches for the counts we got from DB
    const missingCounts = new Set([
      ...missingLikeCounts,
      ...missingRetweetCounts,
      ...missingReplyCounts,
    ]);

    if (missingCounts.size > 0) {
      await this.backfillDynamicDataToCache(
        Array.from(missingCounts),
        likeCountsMap,
        retweetCountsMap,
        replyCountsMap,
      );
    }

    const userTweetInteractions = await this.tweetsRepository.getUserTweetInteractions(
      userId,
      tweetIds,
    );

    return {
      likeCounts: likeCountsMap,
      retweetCounts: retweetCountsMap,
      replyCounts: replyCountsMap,
      userTweetInteractions,
    };
  }

  /**
   * This gets the missing counts from DB
   * @param missingCounts
   * @param likeCountsMap
   * @param retweetCountsMap
   * @param replyCountsMap
   * @param tweets
   * @returns void
   */
  async backfillDynamicDataToCache(
    missingCounts: bigint[],
    likeCountsMap: Map<bigint, number>,
    retweetCountsMap: Map<bigint, number>,
    replyCountsMap: Map<bigint, number>,
  ): Promise<void> {
    const backfillPipeline = this.redisClient.pipeline();

    const missingCountsFromDB = await this.tweetsRepository.getTweetCounts(missingCounts);

    for (const [tweetId, counts] of missingCountsFromDB.entries()) {
      likeCountsMap.set(BigInt(tweetId), counts.likeCounts);
      backfillPipeline.set(
        REDIS_TIMELINE_KEYS.getTweetLikesCountKey(BigInt(tweetId)),
        counts.likeCounts.toString(),
        'EX',
        LIKE_COUNT_CACHE_TTL,
      );

      retweetCountsMap.set(BigInt(tweetId), counts.retweetCounts);
      backfillPipeline.set(
        REDIS_TIMELINE_KEYS.getTweetRetweetsCountKey(BigInt(tweetId)),
        counts.retweetCounts.toString(),
        'EX',
        RETWEET_COUNT_CACHE_TTL,
      );

      replyCountsMap.set(BigInt(tweetId), counts.replyCounts);
      backfillPipeline.set(
        REDIS_TIMELINE_KEYS.getTweetRepliesCountKey(BigInt(tweetId)),
        counts.replyCounts.toString(),
        'EX',
        REPLIES_COUNT_CACHE_TTL,
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
    authors: Map<string, CompactAuthorWithId>;
  }> {
    const tweetsMap = new Map<string, CachedStaticTweet>();
    const authorMap = new Map<string, CompactAuthorWithId>();
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

    this.logger.debug(
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
    this.logger.debug(`Hydrating ${authorIds.length} authors for quoted tweets from cache`);
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

      if (authorErr || authorData === null) {
        missingAuthorIds.add(authorId);
      } else if (typeof authorData === 'string') {
        const authorDto: CompactAuthorWithId = JSON.parse(authorData) as CompactAuthorWithId;
        authorMap.set(authorId.toString(), authorDto);
      }
    }

    this.logger.debug(
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
    authors: Map<string, CompactAuthorWithId>,
    dynamicData: DynamicDataFromCache,
  ): TweetDto[] {
    const timelineTweets = new Array<TweetDto>();

    for (const item of items) {
      const [authorIdStr, tweetIdStr, actionType] = item.split(':');
      const tweet = tweets.get(tweetIdStr);
      const author = authors.get(authorIdStr);
      const retweeterId = actionType === 'R' ? item.split(':')[3] : null;
      const retweeter = retweeterId ? authors.get(retweeterId) : undefined;

      if (!tweet || !author) {
        continue; // never happens
      }

      const likeCount = dynamicData.likeCounts.get(BigInt(tweetIdStr)) ?? 0;
      const retweetCount = dynamicData.retweetCounts.get(BigInt(tweetIdStr)) ?? 0;
      const replyCount = dynamicData.replyCounts.get(BigInt(tweetIdStr)) ?? 0;

      const userInteractions = dynamicData.userTweetInteractions.get(BigInt(tweetIdStr));

      const isLiked = userInteractions?.isLiked ?? false;
      const isRetweeted = userInteractions?.isRetweeted ?? false;

      /* eslint-disable @typescript-eslint/no-unused-vars */
      const { authorId, ...tweetWithoutAuthorId } = tweet; // remove authorId from tweet
      const { id, ...authorWithoutId } = author; // remove id from author dto
      /* eslint-enable @typescript-eslint/no-unused-vars */

      const tweetDto: TweetDto = {
        ...tweetWithoutAuthorId,
        author: authorWithoutId,
        likeCount,
        retweetCount,
        replyCount,
        isLiked,
        isRetweeted,
        repostedBy: retweeter
          ? {
              username: retweeter.username,
              displayName: retweeter.displayName,
            }
          : undefined,
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
        } else {
          tweet.quotedTweet = {
            isDeleted: true,
          };
        }
      }
    }
    return timelineTweets;
  }

  async timelineCacheMiss(userId: bigint, decodedCursor: FeedCursor | undefined): Promise<void> {
    this.logger.debug(`Timeline cache miss for user ID: ${userId}, fetching from DB`);

    // Get the complete timeline from database
    const timelineInfo = await this.tweetsRepository.getTimelineForUser(
      userId,
      decodedCursor,
      undefined, // to fill timeline cache
    );

    if (!timelineInfo || timelineInfo.length === 0) {
      // Set empty placeholder to avoid repeated DB hits
      await this.redisClient.setex(
        REDIS_TIMELINE_KEYS.getUserTimelineEmptyPlaceholderKey(userId),
        TIMELINE_EMPTY_PLACEHOLDER_TTL,
        '1',
      );
      this.logger.debug(`No tweets found for user ID: ${userId}, setting empty placeholder`);
      return;
    }

    this.logger.debug(
      `Fetched ${timelineInfo.length} timeline items (tweets/retweets) from DB for user ID: ${userId}, populating cache`,
    );

    // Populate timeline cache with scored set (using createdAt as score)
    const timelineKey = REDIS_TIMELINE_KEYS.getUserTimelineKey(userId);
    const timelinePipeline = this.redisClient.pipeline();

    for (const item of timelineInfo) {
      const score = item.createdAt.getTime();
      const timelineMember = item.retweeterId
        ? REDIS_TIMELINE_KEYS.getTimelineRetweetItem(item.authorId, item.id, item.retweeterId)
        : REDIS_TIMELINE_KEYS.getTimelineTweetItem(item.authorId, item.id);
      timelinePipeline.zadd(timelineKey, score, timelineMember);
    }

    // Set timeline TTL
    timelinePipeline.expire(timelineKey, TIMELINE_EMPTY_PLACEHOLDER_TTL);
    await timelinePipeline.exec();
  }

  private deduplicateTimelineItems(items: string[]): string[] {
    const seenTweetIds = new Set<string>();
    const uniqueItems: string[] = [];

    for (const item of items) {
      const tweetId = item.split(':')[1];
      if (!seenTweetIds.has(tweetId)) {
        seenTweetIds.add(tweetId);
        uniqueItems.push(item);
      }
    }

    return uniqueItems;
  }

  private extractIdsFromTimelineItems(items: string[]): {
    authorIds: Set<bigint>;
    tweetIds: Set<bigint>;
  } {
    const authorIds = new Set<bigint>();
    const tweetIds = new Set<bigint>();

    for (const item of items) {
      const [authorId, tweetId, actionType, retweeterId] = item.split(':');

      authorIds.add(BigInt(authorId));
      tweetIds.add(BigInt(tweetId));

      if (actionType === 'R' && retweeterId) {
        authorIds.add(BigInt(retweeterId));
      }
    }

    return { authorIds, tweetIds };
  }

  private async getTweetCreatedAt(userId: bigint, timelineItem: string): Promise<Date | null> {
    const timelineKey = REDIS_TIMELINE_KEYS.getUserTimelineKey(userId);
    const score = await this.redisClient.zscore(timelineKey, timelineItem);

    if (score === null) {
      return null;
    }

    return new Date(Number(score));
  }
}
