import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { TweetsRepository } from './tweets.repository';
import {
  MAX_TWEET_DEPTH,
  TWEETS_ERROR_CODES,
  TWEETS_ERROR_MESSAGES,
  TWEET_SUMMARY_CACHE_TTL,
} from './constants';
import { CreateTweetDto } from './dtos/create-tweet.dto';
import { ContentParsingService } from 'src/content-parsing/content-parsing.service';
import { CreateTweetData, PlainHashtag, PlainMention } from './interfaces';
import { PrismaService } from 'src/prisma/prisma.service';
import { Tweet } from '@prisma/client';
import { MediaRepository } from 'src/media/media.repository';
import { UsersRepository } from 'src/users/users.repository';
import { RedisService } from 'src/redis/redis.service';
import { decodeCompositeCursor, paginateComposite } from 'src/common/utils';
import { USERS_ERROR_CODES, USERS_ERROR_MESSAGES } from 'src/users/constants';
import { FeedCursor } from 'src/common/interfaces/cursor.interfaces';
import {
  PAGINATION_ERROR_CODES,
  PAGINATION_ERROR_MESSAGES,
} from 'src/common/constants/pagination-error-codes';
import { GetTweetResponseDto } from './dtos/get-tweet-response.dto';
import {
  TweetRankCursor,
  TweetRelationsCursor,
  UserInteractionsCursor,
} from 'src/common/types/cursors';
import { MediaResponseDto } from 'src/media/dtos/media-response.dto';
import { CompactAuthorDto, TweetDto } from './dtos';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RetweetFanoutJob, TweetFanoutJob } from './timeline/interfaces/tweet-fanout-job.interface';
import { PeopleSearchFilter } from 'src/search/dtos';
import { REDIS_TIMELINE_KEYS } from 'src/common/constants/redis-timeline-keys.constant';
import { COUNT_CACHE_TTL } from './timeline/constants';
import { ThreadViewResponseDto } from './dtos/thread-view-response.dto';
import { DeletedTweet } from './types';
import { TrendingService } from 'src/trending/trending.service';
import { DomainEventsService } from 'src/events/domain-events.service';

@Injectable()
export class TweetsService {
  private readonly logger = new Logger(TweetsService.name);
  private readonly redisClient;

  constructor(
    private readonly tweetsRepository: TweetsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly contentParsingService: ContentParsingService,
    private readonly trendingService: TrendingService,
    private readonly mediaRepository: MediaRepository,
    private readonly domainEvents: DomainEventsService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @InjectQueue('timeline-following') private readonly timelineFollowingQueue: Queue,
  ) {
    this.redisClient = this.redisService.getClient();
  }

  async createTweet(createTweetDto: CreateTweetDto, userId: bigint): Promise<TweetDto> {
    if (createTweetDto.replyToTweetId && createTweetDto.quoteToTweetId) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.INVALID_TWEET_CREATION,
          code: TWEETS_ERROR_CODES.INVALID_TWEET_CREATION,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const trimContent = createTweetDto.content?.trim() ?? '';
    if (!trimContent && (!createTweetDto.media || createTweetDto.media.length === 0)) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.INVALID_TWEET_PAYLOAD,
          code: TWEETS_ERROR_CODES.INVALID_TWEET_PAYLOAD,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    createTweetDto.content = trimContent;

    if (createTweetDto.media && createTweetDto.media.length > 4) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.TOO_MANY_MEDIA,
          code: TWEETS_ERROR_CODES.TOO_MANY_MEDIA,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    let mediaIds: bigint[] = [];
    if (createTweetDto.media && createTweetDto.media.length > 0) {
      mediaIds = createTweetDto.media.map((id) => {
        try {
          return BigInt(id);
        } catch {
          throw new HttpException(
            {
              message: TWEETS_ERROR_MESSAGES.INVALID_MEDIA,
              code: TWEETS_ERROR_CODES.INVALID_MEDIA,
            },
            HttpStatus.BAD_REQUEST,
          );
        }
      });
    }

    await this.validateReferences(
      createTweetDto.replyToTweetId,
      createTweetDto.quoteToTweetId,
      mediaIds,
    );

    const mediaObjectsPromise =
      mediaIds.length > 0
        ? this.mediaRepository.findOrderedMediaObjectsByIds(mediaIds)
        : Promise.resolve([]);
    const authorDtoPromise = this.usersRepository.findOwnTweetAuthorMetaData(userId);
    const referencedTweetId = createTweetDto.quoteToTweetId ?? createTweetDto.replyToTweetId;
    const referencedTweetPromise = referencedTweetId
      ? this.tweetsRepository.getReferencedTweet(BigInt(referencedTweetId), userId)
      : Promise.resolve(undefined);
    // I know this probably confilcts with "nested replies"

    const [mediaObjects, authorDto, referencedTweet] = await Promise.all([
      mediaObjectsPromise,
      authorDtoPromise,
      referencedTweetPromise,
    ]);

    // If this tweet is a reply, set the rootTweetId to the referenced tweet's rootTweetId (if it exists)
    // otherwise set it to the referenced tweet's ID
    let rootTweetId: bigint | null = null;
    if (createTweetDto.replyToTweetId && referencedTweet) {
      rootTweetId = referencedTweet.rootTweetId
        ? BigInt(referencedTweet.rootTweetId)
        : BigInt(createTweetDto.replyToTweetId);
    }

    const { tweet, mentions, hashtags, tweetId, authorId } = await this.prisma.$transaction(
      async (tx) => {
        const { mentions, hashtags } = await this.contentParsingService.parseContentAndValidate(
          trimContent,
          tx,
        );

        const tweetData: CreateTweetData = {
          userId,
          content: trimContent,
          replyToTweetId: createTweetDto.replyToTweetId
            ? BigInt(createTweetDto.replyToTweetId)
            : null,
          quotedTweetId: createTweetDto.quoteToTweetId
            ? BigInt(createTweetDto.quoteToTweetId)
            : null,
          rootTweetId,
          Mentions: mentions.map((mention) => ({
            userId: mention.userId,
            startPosition: mention.startPosition,
          })),
          Hashtags: hashtags.map((hashtag) => ({
            hashtagId: hashtag.hashtagId,
            startPosition: hashtag.startPosition,
          })),
          hasMedia: mediaIds.length > 0,
        };

        if (createTweetDto.replyToTweetId) {
          await this.tweetsRepository.updateTweetReplyCount(
            BigInt(createTweetDto.replyToTweetId),
            true,
            tx,
          );
        }

        if (createTweetDto.quoteToTweetId) {
          await this.tweetsRepository.updateTweetRetweetCount(
            BigInt(createTweetDto.quoteToTweetId),
            true,
            tx,
          );
        }
        const tweet = await this.tweetsRepository.create(tweetData, tx);
        await this.tweetsRepository.linkTweetMedia(tweet.id, mediaIds, tx);
        await this.mediaRepository.markMediaAsNotPending(mediaIds, tx);

        return { tweet, mentions, hashtags, tweetId: tweet.id, authorId: tweet.userId };
      },
    );

    await this.domainEvents.emitTweetCreated({
      tweetId: tweet.id,
      authorId: userId,
      replyToTweetId: tweet.replyToTweetId,
      quoteToTweetId: tweet.quotedTweetId,
      mentionedUserIds: mentions.map((m) => m.userId),
    });

    // dispatch fanout job
    if (!createTweetDto.replyToTweetId) {
      const fanoutJob: TweetFanoutJob = {
        tweetId: tweetId.toString(),
        authorId: authorId.toString(),
        timestamp: Date.now(),
      };

      await this.timelineFollowingQueue.add('fanout-tweet', fanoutJob, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      });

      this.logger.debug(
        `Dispatched fanout on write job for tweet ID: ${tweetId} by user ID: ${userId}`,
      );
    }

    // these never happen together (validated earlier)
    if (createTweetDto.replyToTweetId) {
      this.logger.debug(
        `Incrementing reply count cache for tweet ID: ${createTweetDto.replyToTweetId}`,
      );
      await this.redisService.safeIncr(
        REDIS_TIMELINE_KEYS.getTweetRepliesCountKey(BigInt(createTweetDto.replyToTweetId)),
        COUNT_CACHE_TTL,
      );
    }

    if (createTweetDto.quoteToTweetId) {
      this.logger.debug(
        `Incrementing retweet count cache for tweet ID: ${createTweetDto.quoteToTweetId}`,
      );
      await this.redisService.safeIncr(
        REDIS_TIMELINE_KEYS.getTweetRetweetsCountKey(BigInt(createTweetDto.quoteToTweetId)),
        COUNT_CACHE_TTL,
      );
    }

    if (createTweetDto.replyToTweetId) {
      await this.redisService.safeIncr(
        REDIS_TIMELINE_KEYS.getTweetRepliesCountKey(tweetId),
        COUNT_CACHE_TTL,
      );
    }

    return this.formatTweetDto(
      tweet,
      mentions,
      hashtags,
      mediaObjects,
      authorDto,
      createTweetDto,
      referencedTweet,
    );
  }

  async deleteTweet(tweetId: bigint, userId: bigint) {
    const { exists, replyToTweetId, quoteToTweetId } =
      await this.tweetsRepository.checkExistingTweet(tweetId);
    if (!exists) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
          code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (!(await this.tweetsRepository.checkTweetOwnership(tweetId, userId))) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.TWEET_FORBIDDEN_DELETION,
          code: TWEETS_ERROR_CODES.TWEET_FORBIDDEN_DELETION,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await this.tweetsRepository.deleteTweet(tweetId, tx);
      if (replyToTweetId) {
        await this.tweetsRepository.updateTweetReplyCount(replyToTweetId, false, tx);
      }
      if (quoteToTweetId) {
        await this.tweetsRepository.updateTweetRetweetCount(quoteToTweetId, false, tx);
      }
    });
    this.logger.debug(`User ${userId} deleted tweet ${tweetId} successfully`);

    await this.invalidateTweetCache(tweetId);

    // these never happen together (validated on creation)
    if (replyToTweetId) {
      this.logger.log(`Decrementing reply count cache for tweet ID: ${replyToTweetId}`);
      await this.redisService.safeDecr(
        REDIS_TIMELINE_KEYS.getTweetRepliesCountKey(replyToTweetId),
        COUNT_CACHE_TTL,
      );
    }

    if (quoteToTweetId) {
      this.logger.log(`Decrementing retweet count cache for tweet ID: ${quoteToTweetId}`);
      await this.redisService.safeDecr(
        REDIS_TIMELINE_KEYS.getTweetRetweetsCountKey(quoteToTweetId),
        COUNT_CACHE_TTL,
      );
    }

    return { message: 'Tweet deleted successfully' };
  }

  private formatTweetDto(
    tweet: Tweet,
    mentions: PlainMention[],
    hashtags: PlainHashtag[],
    media: MediaResponseDto[],
    compactAuthorDto: CompactAuthorDto,
    createTweetDto: CreateTweetDto,
    referencedTweet: GetTweetResponseDto | undefined | null,
  ): GetTweetResponseDto {
    return {
      id: tweet.id.toString(),
      author: {
        username: compactAuthorDto.username,
        displayName: compactAuthorDto.displayName,
        avatarUrl: compactAuthorDto.avatarUrl,
      },
      content: tweet.content,
      createdAt: tweet.createdAt,
      replyCount: 0,
      retweetCount: 0,
      likeCount: 0,
      isLiked: false,
      isRetweeted: false,
      entities: {
        mentions: mentions.map((mention) => ({
          username: mention.username,
          startPosition: mention.startPosition,
        })),
        hashtags: hashtags.map((hashtag) => ({
          hashtag: hashtag.keyword,
          startPosition: hashtag.startPosition,
        })),
      },
      media,
      replyToTweetId: createTweetDto.replyToTweetId ?? null,
      quoteToTweetId: createTweetDto.quoteToTweetId ?? null,
      rootTweetId: createTweetDto.replyToTweetId
        ? (referencedTweet?.rootTweetId ?? createTweetDto.replyToTweetId)
        : null,
      quotedTweet: createTweetDto.quoteToTweetId ? referencedTweet || undefined : undefined,
      replyToTweet: createTweetDto.replyToTweetId ? referencedTweet || undefined : undefined,
    };
  }

  private async validateReferences(
    replyToTweetId: string | undefined,
    quoteToTweetId: string | undefined,
    mediaIds: bigint[],
  ) {
    const tweetIdsToCheck: bigint[] = [];

    if (replyToTweetId) {
      try {
        tweetIdsToCheck.push(BigInt(replyToTweetId));
      } catch {
        throw new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
            code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        );
      }
    }

    if (quoteToTweetId) {
      try {
        tweetIdsToCheck.push(BigInt(quoteToTweetId));
      } catch {
        throw new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
            code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        );
      }
    }

    const uniqueMediaIds = mediaIds.length > 0 ? [...new Set(mediaIds)] : [];

    if (tweetIdsToCheck.length === 0 && uniqueMediaIds.length === 0) {
      return;
    }

    // opens one connection for both checks
    const { tweetCount, mediaCount } = await this.tweetsRepository.validateReferences(
      tweetIdsToCheck,
      uniqueMediaIds,
    );

    if (tweetIdsToCheck.length > 0 && tweetCount !== tweetIdsToCheck.length) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
          code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (uniqueMediaIds.length > 0 && mediaCount !== uniqueMediaIds.length) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.INVALID_MEDIA,
          code: TWEETS_ERROR_CODES.INVALID_MEDIA,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // --------------------------------------
  async likeTweet(userId: bigint, tweetId: bigint) {
    const tweet = await this.checkIfTweetExists(tweetId);

    // Check for blocks
    if (userId !== tweet.userId) {
      const isBlocked = await this.usersRepository.areUsersBlocked(userId, tweet.userId);
      if (isBlocked) {
        throw new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.USER_BLOCKED,
            code: TWEETS_ERROR_CODES.USER_BLOCKED,
          },
          HttpStatus.FORBIDDEN,
        );
      }
    }

    // Tweet already liked by user
    const hasLiked = await this.tweetsRepository.hasUserLikedTweet(userId, tweetId);
    if (hasLiked) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.CONFLICTING_LIKE,
          code: TWEETS_ERROR_CODES.CONFLICTING_LIKE,
        },
        HttpStatus.CONFLICT,
      );
    }

    await this.tweetsRepository.likeTweet(userId, tweetId);
    this.logger.debug(`User ${userId} liked tweet ${tweetId} successfully`);

    await this.redisService.safeIncr(
      REDIS_TIMELINE_KEYS.getTweetLikesCountKey(tweetId),
      COUNT_CACHE_TTL,
    );

    await this.domainEvents.emitTweetLiked({
      actorId: userId,
      receiverId: tweet.userId,
      tweetId: tweetId,
    });

    return { message: 'Tweet liked successfully' };
  }

  async unlikeTweet(userId: bigint, tweetId: bigint) {
    await this.checkIfTweetExists(tweetId);

    // Tweet already not liked by user
    const hasLiked = await this.tweetsRepository.hasUserLikedTweet(userId, tweetId);
    if (!hasLiked) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.CONFLICTING_LIKE,
          code: TWEETS_ERROR_CODES.CONFLICTING_LIKE,
        },
        HttpStatus.CONFLICT,
      );
    }

    await this.tweetsRepository.unlikeTweet(userId, tweetId);

    await this.redisService.safeDecr(
      REDIS_TIMELINE_KEYS.getTweetLikesCountKey(tweetId),
      COUNT_CACHE_TTL,
    );

    this.logger.log(`User ${userId} unliked tweet ${tweetId} successfully`);

    return { message: 'Tweet unliked successfully' };
  }

  async retweetTweet(userId: bigint, tweetId: bigint) {
    const tweet = await this.checkIfTweetExists(tweetId);

    // Check for blocks
    if (userId !== tweet.userId) {
      const isBlocked = await this.usersRepository.areUsersBlocked(userId, tweet.userId);
      if (isBlocked) {
        throw new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.USER_BLOCKED,
            code: TWEETS_ERROR_CODES.USER_BLOCKED,
          },
          HttpStatus.FORBIDDEN,
        );
      }
    }

    // Tweet already retweeted by user
    const hasRetweeted = await this.tweetsRepository.hasUserRetweetedTweet(userId, tweetId);
    if (hasRetweeted) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.CONFLICTING_RETWEET,
          code: TWEETS_ERROR_CODES.CONFLICTING_RETWEET,
        },
        HttpStatus.CONFLICT,
      );
    }

    await this.tweetsRepository.retweetTweet(userId, tweetId);
    this.logger.debug(`User ${userId} retweeted tweet ${tweetId} successfully`);

    //dispatch retweet fanout job
    const fanoutJob: RetweetFanoutJob = {
      tweetId: tweetId.toString(),
      authorId: tweet.userId.toString(),
      timestamp: Date.now(),
      retweeterId: userId.toString(),
    };

    await this.timelineFollowingQueue.add('fanout-retweet', fanoutJob, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });

    await this.redisService.safeIncr(
      REDIS_TIMELINE_KEYS.getTweetRetweetsCountKey(tweetId),
      COUNT_CACHE_TTL,
    );

    await this.domainEvents.emitTweetRetweeted({
      actorId: userId,
      receiverId: tweet.userId,
      tweetId: tweetId,
    });

    return { message: 'Tweet retweeted successfully' };
  }

  async unretweetTweet(userId: bigint, tweetId: bigint) {
    const tweet = await this.tweetsRepository.findTweetById(tweetId);
    if (!tweet) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
          code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // Tweet already not retweeted by user
    const hasRetweeted = await this.tweetsRepository.hasUserRetweetedTweet(userId, tweetId);
    if (!hasRetweeted) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.CONFLICTING_RETWEET,
          code: TWEETS_ERROR_CODES.CONFLICTING_RETWEET,
        },
        HttpStatus.CONFLICT,
      );
    }

    await this.tweetsRepository.unretweetTweet(userId, tweetId);
    this.logger.debug(`User ${userId} unretweeted tweet ${tweetId} successfully`);

    //dispatch retweet purge job
    const purgeJob: RetweetFanoutJob = {
      tweetId: tweetId.toString(),
      authorId: tweet.userId.toString(),
      timestamp: Date.now(),
      retweeterId: userId.toString(),
    };

    await this.timelineFollowingQueue.add('purge-retweet', purgeJob, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });

    await this.redisService.safeDecr(
      REDIS_TIMELINE_KEYS.getTweetRetweetsCountKey(tweetId),
      COUNT_CACHE_TTL,
    );

    return { message: 'Tweet unretweeted successfully' };
  }
  async getUserPosts(
    username: string,
    authUserId: bigint,
    limit: number,
    prevCursor: string | undefined,
  ) {
    // False = Filter OUT replies
    return this.getGenericProfileFeed(username, authUserId, limit, prevCursor, false);
  }

  async getUserPostsAndReplies(
    username: string,
    authUserId: bigint,
    limit: number,
    prevCursor: string | undefined,
  ) {
    return this.getGenericProfileFeed(username, authUserId, limit, prevCursor, true);
  }

  private async getGenericProfileFeed(
    username: string,
    authUserId: bigint,
    limit: number,
    prevCursor: string | undefined,
    includeReplies: boolean,
  ) {
    const requestedUser = await this.usersRepository.findByUsernameWithDisplayname(username);

    if (!requestedUser) {
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }
    let decoded: FeedCursor | undefined;
    if (prevCursor) {
      try {
        decoded = decodeCompositeCursor<FeedCursor>(prevCursor);
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
    const feedItems = await this.tweetsRepository.getFeedSkeletonSQL(
      requestedUser.id,
      limit + 1,
      decoded,
      includeReplies,
    );

    const pagination = paginateComposite(feedItems, limit, prevCursor, (item) => ({
      id: item?.id.toString(),
      createdAt: item?.created_at,
    }));

    const tweetIds = [...new Set(feedItems.map((item) => item.id))];

    const fullTweets = await this.tweetsRepository.hydrateTweetsInList(authUserId, tweetIds);

    const fullTweetsDto = fullTweets.map((tweet) =>
      this.tweetsRepository.mapToDetailedTweetDto(tweet),
    );

    const tweetsMap = new Map(fullTweetsDto.map((t) => [t.id.toString(), t]));

    const items = feedItems
      .map((item): TweetDto | null => {
        const tweetData = tweetsMap.get(item.id.toString());

        if (!tweetData) return null; // Should technically never happen

        return {
          ...tweetData,
          repostedBy:
            item.type === 'repost'
              ? {
                  username: requestedUser?.username || '',
                  displayName: requestedUser.profile?.displayName || '',
                }
              : undefined,
          createdAt: item.created_at,
        };
      })
      .filter(Boolean);

    return { items, pagination };
  }

  async getTweet(tweetId: bigint, currentUserId: bigint | null): Promise<ThreadViewResponseDto> {
    const tweet = await this.tweetsRepository.getDetailedTweetById(tweetId, currentUserId);

    if (!tweet) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
          code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (!currentUserId) {
      return { ...tweet, rootTweet: null, parentTweets: [], hasMoreParents: false };
    }

    let rootTweet: TweetDto | DeletedTweet | null = null;
    let parentTweets: (TweetDto | DeletedTweet)[] = [];
    let hasMoreParents = false;

    // If this is a reply, fetch the root tweet
    if (tweet?.rootTweetId) {
      rootTweet = await this.tweetsRepository.getTweetOrDeleted(
        BigInt(tweet.rootTweetId),
        currentUserId,
      );
    }

    // Fetch parent tweets (intermediate tweets between root and this tweet)
    if (tweet.replyToTweetId) {
      parentTweets = await this.tweetsRepository.getParentTweets(
        BigInt(tweet.replyToTweetId),
        currentUserId,
        tweet.rootTweetId ? BigInt(tweet.rootTweetId) : null,
      );
    }

    if (parentTweets.length >= MAX_TWEET_DEPTH) {
      // Remove the oldest tweet to maintain the depth limit
      parentTweets = parentTweets.slice(1);
      hasMoreParents = true;
    }

    return {
      ...tweet,
      rootTweet,
      parentTweets,
      hasMoreParents,
    };
  }

  async getTweetQuotes(
    tweetId: bigint,
    currentUserId: bigint,
    limit: number = 20,
    prevCursor?: string,
  ) {
    return this.getTweetRelations('quotes', tweetId, currentUserId, limit, prevCursor);
  }

  async getTweetReplies(
    tweetId: bigint,
    currentUserId: bigint,
    limit: number = 20,
    prevCursor?: string,
  ) {
    return this.getTweetRelations('replies', tweetId, currentUserId, limit, prevCursor);
  }

  async getTweetRetweeters(
    tweetId: bigint,
    currentUserId: bigint,
    limit: number,
    prevCursor?: string,
  ) {
    return this.getTweetUserInteractions('retweets', tweetId, currentUserId, limit, prevCursor);
  }

  async getTweetLikers(tweetId: bigint, currentUserId: bigint, limit: number, prevCursor?: string) {
    return this.getTweetUserInteractions('likes', tweetId, currentUserId, limit, prevCursor);
  }

  async getTweetRelations(
    type: 'replies' | 'quotes',
    tweetId: bigint,
    currentUserId: bigint,
    limit: number,
    prevCursor?: string,
  ) {
    await this.checkIfTweetExists(tweetId);

    let decodedCursor: TweetRelationsCursor | undefined;
    if (prevCursor) {
      try {
        decodedCursor = decodeCompositeCursor<TweetRelationsCursor>(prevCursor);
      } catch {
        throw new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.INVALID_CURSOR,
            code: TWEETS_ERROR_CODES.INVALID_CURSOR,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const items =
      type === 'replies'
        ? await this.tweetsRepository.getTweetReplies(
            tweetId,
            currentUserId,
            limit + 1,
            decodedCursor,
          )
        : await this.tweetsRepository.getTweetQuotes(
            tweetId,
            currentUserId,
            limit + 1,
            decodedCursor,
          );

    const pagination = paginateComposite(items, limit, prevCursor, (relation) => ({
      createdAt: relation.createdAt,
      id: relation.id.toString(),
    }));

    this.logger.debug(`Fetched ${items.length} ${type} for tweet ID: ${tweetId}`);

    return { items, pagination };
  }

  private async getTweetUserInteractions(
    type: 'likes' | 'retweets',
    tweetId: bigint,
    currentUserId: bigint,
    limit: number,
    prevCursor?: string,
  ) {
    await this.checkIfTweetExists(tweetId);

    let decodedCursor: UserInteractionsCursor | undefined;
    if (prevCursor) {
      try {
        decodedCursor = decodeCompositeCursor<UserInteractionsCursor>(prevCursor);
      } catch {
        throw new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.INVALID_CURSOR,
            code: TWEETS_ERROR_CODES.INVALID_CURSOR,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const items =
      type === 'likes'
        ? await this.tweetsRepository.getTweetLikers(
            tweetId,
            currentUserId,
            limit + 1,
            decodedCursor,
          )
        : await this.tweetsRepository.getTweetRetweeters(
            tweetId,
            currentUserId,
            limit + 1,
            decodedCursor,
          );

    const pagination = paginateComposite(items, limit, prevCursor, (interaction) => {
      return {
        userId: interaction.userId,
        tweetId: tweetId.toString(),
      };
    });

    this.logger.debug(`Fetched ${items.length} ${type} for tweet ID: ${tweetId}`);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const safeItems = items.map(({ userId, ...rest }) => rest);
    return { items: safeItems, pagination };
  }

  async checkIfTweetExists(tweetId: bigint) {
    const tweet = await this.tweetsRepository.findTweetById(tweetId);
    if (!tweet || tweet.isDeleted) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
          code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }
    return tweet;
  }

  async getUserLikedTweets(
    requestingUserId: bigint,
    targetUsername: string,
    limit: number,
    prevCursor?: string,
  ) {
    const targetUser = await this.usersRepository.findByUsername(targetUsername);

    if (!targetUser || targetUser.deletedAt) {
      // TODO remove if done on global level
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    let decodedCursor: UserInteractionsCursor | undefined;
    if (prevCursor) {
      try {
        decodedCursor = decodeCompositeCursor<UserInteractionsCursor>(prevCursor);
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

    const tweets = await this.tweetsRepository.getUserLikedTweets(
      targetUser.id,
      requestingUserId,
      limit + 1,
      decodedCursor,
    );

    const pagination = paginateComposite(tweets, limit, prevCursor, (tweet) => ({
      userId: targetUser.id.toString(),
      tweetId: tweet.id,
    }));

    return {
      items: tweets.slice(0, limit),
      pagination,
    };
  }

  async getTopTweetsByQuery(
    currentUserId: bigint,
    query: string,
    limit: number,
    decodedCursor?: TweetRankCursor,
    excludeMutedAndBlocked?: boolean,
    peopleFilter?: PeopleSearchFilter,
  ) {
    return await this.tweetsRepository.getRankedTweetsByQuery(
      currentUserId,
      query,
      false,
      excludeMutedAndBlocked,
      peopleFilter,
      limit + 1,
      decodedCursor,
    );
  }

  async getLatestTweetsByQuery(
    currentUserId: bigint,
    query: string,
    limit: number,
    decodedCursor?: TweetRelationsCursor,
    excludeMutedAndBlocked?: boolean,
    peopleFilter?: PeopleSearchFilter,
  ) {
    return await this.tweetsRepository.getLatestTweetsByQuery(
      currentUserId,
      query,
      excludeMutedAndBlocked,
      peopleFilter,
      limit + 1,
      decodedCursor,
    );
  }
  async getTweetsWithMediaByQuery(
    currentUserId: bigint,
    query: string,
    limit: number,
    decodedCursor?: TweetRankCursor,
    excludeMutedAndBlocked?: boolean,
    peopleFilter?: PeopleSearchFilter,
  ) {
    return await this.tweetsRepository.getRankedTweetsByQuery(
      currentUserId,
      query,
      true,
      excludeMutedAndBlocked,
      peopleFilter,
      limit + 1,
      decodedCursor,
    );
  }

  async getTweetsByHashtag(
    hashtag: string,
    currentUserId: bigint,
    limit: number,
    hasMedia: boolean = false,
    prevCursor?: TweetRelationsCursor,
    excludeMutedAndBlocked?: boolean,
    peopleFilter?: PeopleSearchFilter,
  ) {
    // Get hashtag record
    const hashtagRecord = await this.trendingService.getHashtagId(hashtag);
    if (!hashtagRecord) {
      return [];
    }

    // Get tweet ids from tweet hashtags table
    const tweetIds = await this.tweetsRepository.getTweetIdsLinkedToHashtag(
      hashtagRecord.id,
      currentUserId,
      limit + 1,
      hasMedia,
      excludeMutedAndBlocked,
      peopleFilter,
      prevCursor,
    );

    // Get full tweets data
    return await this.tweetsRepository.getTweetsWithReferencesByIds(currentUserId, tweetIds);
  }

  async getUserMediaTweets(
    requestingUserId: bigint,
    targetUsername: string,
    limit: number,
    prevCursor: string | undefined,
  ) {
    const targetUser = await this.usersRepository.findByUsername(targetUsername);

    if (!targetUser || targetUser.deletedAt) {
      // TODO remove if done on global level
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    let decodedCursor: TweetRelationsCursor | undefined;
    if (prevCursor) {
      try {
        decodedCursor = decodeCompositeCursor<TweetRelationsCursor>(prevCursor);
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

    const tweets = await this.tweetsRepository.getMediaTweetsForUser(
      targetUser.id,
      requestingUserId,
      limit + 1,
      decodedCursor,
    );

    const pagination = paginateComposite(tweets, limit, prevCursor, (tweet) => ({
      id: tweet.id,
      createdAt: tweet.createdAt,
    }));

    return {
      items: tweets.slice(0, limit),
      pagination,
    };
  }

  async invalidateTweetCache(tweetId: bigint) {
    const deletionPipeline = this.redisClient.pipeline();
    deletionPipeline.del(REDIS_TIMELINE_KEYS.getTweetStaticDataKey(tweetId));
    deletionPipeline.del(REDIS_TIMELINE_KEYS.getTweetLikesCountKey(tweetId));
    deletionPipeline.del(REDIS_TIMELINE_KEYS.getTweetRetweetsCountKey(tweetId));
    deletionPipeline.del(REDIS_TIMELINE_KEYS.getTweetRepliesCountKey(tweetId));
    await deletionPipeline.exec();
  }

  async getTweetSummary(
    tweetId: bigint,
    langcode: string,
  ): Promise<{ id: string; summary: string }> {
    const tweet = await this.checkIfTweetExists(tweetId);
    if (tweet.isDeleted) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
          code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (!tweet.content || tweet.content.length === 0) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.EMPTY_TWEET_CONTENT,
          code: TWEETS_ERROR_CODES.EMPTY_TWEET_CONTENT,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check Redis cache first
    const cacheKey = `tweet:summary:${tweetId.toString()}:${langcode}`;
    const cachedSummary = await this.redisService.getex(cacheKey, TWEET_SUMMARY_CACHE_TTL);

    if (cachedSummary) {
      this.logger.log(`Returning cached summary for tweet ${tweetId} with lang ${langcode}`);
      return {
        id: tweet.id.toString(),
        summary: cachedSummary,
      };
    }

    // Generate new summary if not cached
    const summary = await this.contentParsingService.generateTweetSummary(tweet.content, langcode);

    // Cache the summary with TTL
    await this.redisService.set(cacheKey, summary, TWEET_SUMMARY_CACHE_TTL);
    this.logger.debug(`Cached summary for tweet ${tweetId} with TTL ${TWEET_SUMMARY_CACHE_TTL}s`);

    return {
      id: tweet.id.toString(),
      summary,
    };
  }
}
