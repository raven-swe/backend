import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { TweetsRepository } from './tweets.repository';
import { TWEETS_ERROR_CODES, TWEETS_ERROR_MESSAGES } from './constants';
import { CreateTweetDto } from './dtos/create-tweet.dto';
import { ContentParsingService } from 'src/content-parsing/content-parsing.service';
import { CreateTweetData, PlainHashtag, PlainMention } from './interfaces';
import { PrismaService } from 'src/prisma/prisma.service';
import { Tweet } from '@prisma/client';
import { MediaRepository } from 'src/media/media.repository';
import { UsersRepository } from 'src/users/users.repository';
import {
  decodeCompositeCursor,
  decodeCursor,
  paginateComposite,
  paginateSingle,
} from 'src/common/utils';
import { USERS_ERROR_CODES, USERS_ERROR_MESSAGES } from 'src/users/constants';
import { FeedCursor } from 'src/common/interfaces/cursor.interfaces';
import {
  PAGINATION_ERROR_CODES,
  PAGINATION_ERROR_MESSAGES,
} from 'src/common/constants/pagination-error-codes';
import { GetTweetResponseDto } from './dtos/get-tweet-response.dto';
import { TweetRelationsCursor, UserInteractionsCursor } from 'src/common/types/cursors';
import { MediaResponseDto } from 'src/media/dtos/media-response.dto';
import { AuthorDto, TweetDto } from './dtos';
import { VALIDATION_ERROR_CODES } from 'src/common/constants';

@Injectable()
export class TweetsService {
  private readonly logger = new Logger(TweetsService.name);

  constructor(
    private readonly tweetsRepository: TweetsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly contentParsingService: ContentParsingService,
    private readonly mediaRepository: MediaRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getTimeline(userId: bigint, cursor: string, limit: number) {
    this.logger.log(`Fetching following timeline for user ID: ${userId}`);
    const id = decodeCursor(cursor);
    const timeline = await this.tweetsRepository.getTimelineForUser(userId, id, limit + 1);
    const validTweets = timeline.filter((tweet) => tweet !== undefined);

    const pagination = paginateSingle(validTweets, limit, cursor, (tweet) => tweet.id.toString());
    return {
      items: validTweets,
      pagination,
    };
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
    if (!createTweetDto.content && (!createTweetDto.media || createTweetDto.media.length === 0)) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.INVALID_TWEET_PAYLOAD,
          code: TWEETS_ERROR_CODES.INVALID_TWEET_PAYLOAD,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
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
      mediaIds = createTweetDto.media.map((id) => BigInt(id));
    }

    await this.checkReplyAndQuoteTweetsExist(
      createTweetDto.replyToTweetId,
      createTweetDto.quoteToTweetId,
    );
    await this.validateMediaExists(mediaIds);

    const { tweet, mentions, hashtags } = await this.prisma.$transaction(async (tx) => {
      const { mentions, hashtags } = await this.contentParsingService.parseContentAndValidate(
        createTweetDto.content,
        tx,
      );

      const tweetData: CreateTweetData = {
        userId,
        content: createTweetDto.content,
        replyToTweetId: createTweetDto.replyToTweetId
          ? BigInt(createTweetDto.replyToTweetId)
          : null,
        quotedTweetId: createTweetDto.quoteToTweetId ? BigInt(createTweetDto.quoteToTweetId) : null,
        Mentions: mentions.map((mention) => ({
          userId: mention.userId,
          startPosition: mention.startPosition,
        })),
        Hashtags: hashtags.map((hashtag) => ({
          hashtagId: hashtag.hashtagId,
          startPosition: hashtag.startPosition,
        })),
      };

      const tweet = await this.tweetsRepository.create(tweetData, tx);
      await this.tweetsRepository.linkTweetMedia(tweet.id, mediaIds, tx);
      await this.mediaRepository.markMediaAsNotPending(mediaIds);

      return { tweet, mentions, hashtags };
    });

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
    if (!(await this.tweetsRepository.checkExistingTweet(tweetId))) {
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

    await this.tweetsRepository.deleteTweet(tweetId);
    this.logger.log(`User ${userId} deleted tweet ${tweetId} successfully`);
    return { message: 'Tweet deleted successfully' };
  }

  private formatTweetDto(
    tweet: Tweet,
    mentions: PlainMention[],
    hashtags: PlainHashtag[],
    media: MediaResponseDto[],
    authorDto: AuthorDto,
    createTweetDto: CreateTweetDto,
    referencedTweet: GetTweetResponseDto | undefined | null,
  ): GetTweetResponseDto {
    return {
      id: tweet.id.toString(),
      author: {
        username: authorDto.username,
        displayName: authorDto.displayName,
        avatarUrl: authorDto.avatarUrl,
        isBlocked: false,
        isFollowing: false,
        isMuted: false,
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
      quotedTweet: createTweetDto.quoteToTweetId ? referencedTweet || undefined : undefined,
      replyToTweet: createTweetDto.replyToTweetId ? referencedTweet || undefined : undefined,
    };
  }

  private async checkReplyAndQuoteTweetsExist(
    replyToTweetId: string | undefined,
    quoteToTweetId: string | undefined,
  ) {
    if (
      replyToTweetId &&
      !(await this.tweetsRepository.checkExistingTweet(BigInt(replyToTweetId)))
    ) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
          code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (
      quoteToTweetId &&
      !(await this.tweetsRepository.checkExistingTweet(BigInt(quoteToTweetId)))
    ) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
          code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async validateMediaExists(mediaIds: bigint[]) {
    if (mediaIds.length === 0) {
      return;
    }
    const allExist = await this.mediaRepository.checkMediaExists(mediaIds);
    if (!allExist) {
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
    this.logger.log(`User ${userId} liked tweet ${tweetId} successfully`);

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
    this.logger.log(`User ${userId} retweeted tweet ${tweetId} successfully`);

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
    this.logger.log(`User ${userId} unretweeted tweet ${tweetId} successfully`);

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
    const requestedUser = await this.usersRepository.findByUsername(username);

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

    const fullTweetsDto = fullTweets.map((tweet) => this.tweetsRepository.mapToTweetDto(tweet));

    const tweetsMap = new Map(fullTweetsDto.map((t) => [t.id.toString(), t]));

    const items = feedItems
      .map((item) => {
        const tweetData = tweetsMap.get(item.id.toString());

        if (!tweetData) return null; // Should technically never happen

        return {
          ...tweetData,
          isRepost: item.type === 'repost',
          createdAt: item.created_at,
        };
      })
      .filter(Boolean); // Remove any nulls

    return { items, pagination };
  }

  async getTweet(tweetId: bigint, currentUserId: bigint): Promise<GetTweetResponseDto | null> {
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
    return tweet;
  }

  async getTweetQuotes(
    tweetId: bigint,
    currentUserId: bigint,
    limit: number = 20,
    prevCursor?: string,
  ) {
    return this.getTweetRelations('quotes', tweetId, currentUserId, limit, prevCursor);
  }

  getTweetReplies(tweetId: bigint, currentUserId: bigint, limit: number = 20, prevCursor?: string) {
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

    this.logger.log(`Fetched ${items.length} ${type} for tweet ID: ${tweetId}`);

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

    this.logger.log(`Fetched ${items.length} ${type} for tweet ID: ${tweetId}`);

    return { items, pagination };
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
          { message: 'Invalid cursor format', code: VALIDATION_ERROR_CODES.INVALID_FORMAT },
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
}
