import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { TweetDto, UserInteractionDto } from './dtos';
import { FeedCursor } from 'src/common/interfaces/cursor.interfaces';
import { FeedSkeleton } from './interfaces';
import { CreateTweetData } from './interfaces/create-tweet-data.interface';
import { GetTweetResponseDto } from './dtos/get-tweet-response.dto';
import { UserInteractionsCursor, TweetRelationsCursor } from 'src/common/types/cursors';
import { BioEntitiesDto } from 'src/users/dtos';
import { plainToInstance } from 'class-transformer';
import { ReplyTweetDto } from './dtos/reply-tweet.dto';
import { CachedStaticTweet } from './interfaces/cached-static-tweet';
import { CompactAuthorWithId } from './dtos/compact-author.dto';
import { TIMELINE_MAX_SIZE } from './timeline/constants';
import { PeopleSearchFilter } from 'src/search/dtos';
import { TweetsBackfill } from './timeline/interfaces';
import { MAX_TWEET_DEPTH, TWEETS_ERROR_CODES, TWEETS_ERROR_MESSAGES } from './constants';
import { DeletedTweet, TweetOrDeleted } from './types';
import { DEFAULT_PROFILE_PICTURE } from 'src/users/constants';

export const tweetInclude = (currentUserId: bigint) =>
  ({
    user: {
      select: {
        username: true,
        id: true,
        profile: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    },
    _count: {
      select: {
        likes: {
          where: { userId: currentUserId },
        },
        retweets: {
          where: { userId: currentUserId },
        },
      },
    },
    tweetMentions: {
      select: {
        startPosition: true,
        user: {
          select: {
            username: true,
          },
        },
      },
    },
    tweetHashtags: {
      select: {
        startPosition: true,
        hashtag: {
          select: {
            keyword: true,
          },
        },
      },
    },
    tweetMedia: {
      select: {
        order: true,
        media: {
          select: {
            url: true,
            type: true,
            altText: true,
            width: true,
            height: true,
          },
        },
      },
      orderBy: { order: 'asc' },
    },
  }) satisfies Prisma.TweetInclude;

type BaseTweetWithIncludes = Prisma.TweetGetPayload<{
  include: ReturnType<typeof tweetInclude>;
}>;

type TweetWithIncludes = BaseTweetWithIncludes & {
  quotedTweet?: (BaseTweetWithIncludes & { quotedTweet?: null }) | null;
};

type DetailedTweetWithIncludes = BaseTweetWithIncludes & {
  quotedTweet?: (BaseTweetWithIncludes & { quotedTweet?: null }) | null;
  replyToTweet?: (BaseTweetWithIncludes & { replyToTweet?: null }) | null;
};

@Injectable()
export class TweetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getTimelineForUser(
    userId: bigint,
    cursor: FeedCursor | undefined,
    limit: number | undefined,
  ): Promise<
    Array<{
      id: bigint;
      authorId: bigint;
      createdAt: Date;
      type: 'T' | 'R';
      retweeterId: bigint | null;
    }>
  > {
    // get followed users
    const followedUnMutedUserIds = await this.prisma.follow.findMany({
      where: {
        followerId: userId,
      },
      select: { followedId: true },
    });
    const followedUserIds = followedUnMutedUserIds.map((follow) => follow.followedId);

    // The timeline consists of tweets from followed users plus the user's own tweets.
    const timelineUserIds = [...followedUserIds, userId];

    const cursorTime = cursor ? new Date(cursor.createdAt).getTime() : null;
    const cursorId = cursor ? BigInt(cursor.id) : null;

    const cursorClause =
      cursor && cursorTime !== null
        ? Prisma.sql`
        AND (
          EXTRACT(EPOCH FROM "createdAt") * 1000, -- timestamp
          id
        ) < (${cursorTime}, ${cursorId})
      `
        : Prisma.sql``;

    const timeline = await this.prisma.$queryRaw<
      Array<{
        id: bigint;
        authorId: bigint;
        createdAt: Date;
        type: 'T' | 'R';
        retweeterId: bigint | null;
      }>
    >`
    SELECT * FROM (
      SELECT 
        id,
        user_id as "authorId",
        created_at as "createdAt",
        'T'::text as type,
        NULL::bigint as "retweeterId"
      FROM tweets
      WHERE user_id = ANY(${timelineUserIds}::bigint[])
        AND is_deleted = false
        AND reply_to_tweet_id IS NULL
      
      UNION ALL -- no duplicates will happen due to different columns, duplicates are handled in application layer
      
      SELECT 
        r.tweet_id as id,
        t.user_id as "authorId",
        r.created_at as "createdAt",
        'R'::text as type,
        r.user_id as "retweeterId"
      FROM retweets r
      INNER JOIN tweets t ON r.tweet_id = t.id
      WHERE r.user_id = ANY(${timelineUserIds}::bigint[])
        AND t.is_deleted = false
    ) AS combined_timeline
    WHERE 1=1 ${cursorClause}
    ORDER BY "createdAt" DESC, id DESC
    LIMIT ${limit || TIMELINE_MAX_SIZE}
  `;

    return timeline.map((item) => ({
      id: item.id,
      authorId: item.authorId,
      createdAt: item.createdAt,
      type: item.type,
      retweeterId: item.retweeterId,
    }));
  }

  mapToTweetDto(
    tweet: TweetWithIncludes,
    context: { isRepost?: boolean; repostedBy?: { username: string; displayName: string } } = {},
  ): TweetDto {
    let quotedTweet: TweetDto | DeletedTweet | undefined = undefined;
    if (tweet.quotedTweet) {
      if (!tweet.quotedTweet.isDeleted) {
        quotedTweet = this.mapToTweetDto(tweet.quotedTweet);
      } else {
        quotedTweet = {
          isDeleted: true,
        };
      }
    }

    return {
      id: tweet.id.toString(),
      author: {
        username: tweet.user.username,
        displayName: tweet.user.profile?.displayName ?? '',
        avatarUrl: tweet.user.profile?.avatarUrl || DEFAULT_PROFILE_PICTURE,
      },
      content: tweet.content ?? '',
      createdAt: tweet.createdAt,
      replyCount: tweet.replyCount,
      retweetCount: tweet.retweetCount,
      likeCount: tweet.likeCount,
      isLiked: tweet._count.likes > 0,
      isRetweeted: tweet._count.retweets > 0,
      entities: {
        mentions: tweet.tweetMentions.map((mention) => ({
          username: mention.user.username,
          startPosition: mention.startPosition,
        })),
        hashtags: tweet.tweetHashtags.map((hashtag) => ({
          hashtag: hashtag.hashtag.keyword,
          startPosition: hashtag.startPosition,
        })),
      },
      media: tweet.tweetMedia?.map((media) => ({
        url: media.media.url,
        type: media.media.type,
        altText: media.media.altText,
        width: media.media.width ?? 0,
        height: media.media.height ?? 0,
      })),
      replyToTweetId: tweet.replyToTweetId?.toString() ?? null,
      quoteToTweetId: tweet.quotedTweetId?.toString() ?? null,
      rootTweetId: tweet.rootTweetId?.toString() ?? null,
      quotedTweet,
      repostedBy: context.repostedBy ?? undefined,
    };
  }

  async create(tweetData: CreateTweetData, prismaClient: Prisma.TransactionClient = this.prisma) {
    return prismaClient.tweet.create({
      data: {
        userId: tweetData.userId,
        content: tweetData.content ?? '',
        replyToTweetId: tweetData.replyToTweetId,
        quotedTweetId: tweetData.quotedTweetId,
        rootTweetId: tweetData.rootTweetId ?? null,
        hasMentions: tweetData.Mentions.length > 0,
        hasHashtags: tweetData.Hashtags.length > 0,
        tweetMentions: {
          createMany: {
            data: tweetData.Mentions,
          },
        },
        tweetHashtags: {
          createMany: {
            data: tweetData.Hashtags,
          },
        },
        hasMedia: tweetData.hasMedia,
      },
    });
  }

  async linkTweetMedia(
    tweetId: bigint,
    mediaIds: bigint[],
    prismaClient: Prisma.TransactionClient = this.prisma,
  ) {
    const tweetMediaData = mediaIds.map((mediaId, index) => ({
      tweetId,
      mediaId,
      order: index,
    }));

    await prismaClient.tweetMedia.createMany({
      data: tweetMediaData,
    });
  }

  async checkExistingTweet(tweetId: bigint): Promise<{
    exists: boolean;
    replyToTweetId: bigint | null;
    quoteToTweetId: bigint | null;
  }> {
    const tweet = await this.prisma.tweet.findUnique({
      where: { id: tweetId, isDeleted: false },
      select: { id: true, replyToTweetId: true, quotedTweetId: true },
    });
    return {
      exists: !!tweet,
      replyToTweetId: tweet ? tweet.replyToTweetId : null,
      quoteToTweetId: tweet ? tweet.quotedTweetId : null,
    };
  }

  async checkTweetOwnership(tweetId: bigint, userId: bigint): Promise<boolean> {
    const tweet = await this.prisma.tweet.findUnique({
      where: { id: tweetId, userId, isDeleted: false },
      select: { id: true },
    });
    return !!tweet;
  }

  async deleteTweet(tweetId: bigint, prismaClient: Prisma.TransactionClient) {
    await prismaClient.tweet.update({
      where: { id: tweetId },
      data: { isDeleted: true },
    });
    await prismaClient.retweet.deleteMany({
      where: { tweetId },
    });
    await prismaClient.notification.deleteMany({
      where: { tweetId },
    });
    await prismaClient.like.deleteMany({
      where: { tweetId },
    });
  }

  mapToDetailedTweetDto(tweet: DetailedTweetWithIncludes): TweetDto & { replyToTweet?: TweetDto } {
    const baseTweet = this.mapToTweetDto(tweet);

    return {
      ...baseTweet,
      replyToTweet: tweet.replyToTweet ? this.mapToTweetDto(tweet.replyToTweet) : undefined,
    };
  }

  async validateReferences(
    tweetIds: bigint[],
    mediaIds: bigint[],
  ): Promise<{
    tweetCount: number;
    mediaCount: number;
  }> {
    const results = await this.prisma.$queryRaw<
      Array<{ tweet_count: bigint; media_count: bigint }>
    >`
      SELECT 
        (SELECT COUNT(*) FROM tweets WHERE id = ANY(${tweetIds}::bigint[]) AND is_deleted = false) as tweet_count,
        (SELECT COUNT(*) FROM media WHERE id = ANY(${mediaIds}::bigint[])) as media_count
    `;

    return {
      tweetCount: results[0]?.tweet_count ? Number(results[0].tweet_count) : 0,
      mediaCount: results[0]?.media_count ? Number(results[0].media_count) : 0,
    };
  }

  async updateTweetReplyCount(
    tweetId: bigint,
    increment = true,
    prismaClient: Prisma.TransactionClient = this.prisma,
  ) {
    await prismaClient.tweet.update({
      where: { id: tweetId },
      data: {
        replyCount: {
          ...(increment ? { increment: 1 } : { decrement: 1 }),
        },
      },
    });
  }

  async updateTweetRetweetCount(
    tweetId: bigint,
    increment = true,
    prismaClient: Prisma.TransactionClient = this.prisma,
  ) {
    await prismaClient.tweet.update({
      where: { id: tweetId },
      data: {
        retweetCount: {
          ...(increment ? { increment: 1 } : { decrement: 1 }),
        },
      },
    });
  }

  async likeTweet(userId: bigint, tweetId: bigint) {
    await this.prisma
      .$transaction(async (tx) => {
        await tx.like.create({
          data: {
            userId,
            tweetId,
          },
        });

        await tx.tweet.update({
          where: { id: tweetId },
          data: {
            likeCount: {
              increment: 1,
            },
          },
        });
      })
      .catch((e) => {
        //unique constraint
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new HttpException(
            {
              message: TWEETS_ERROR_MESSAGES.CONFLICTING_LIKE,
              code: TWEETS_ERROR_CODES.CONFLICTING_LIKE,
            },
            HttpStatus.CONFLICT,
          );
        } else {
          throw e;
        }
      });
  }

  async unlikeTweet(userId: bigint, tweetId: bigint) {
    await this.prisma
      .$transaction(async (tx) => {
        await tx.like.delete({
          where: {
            userId_tweetId: {
              userId,
              tweetId,
            },
          },
        });

        await tx.notification.deleteMany({
          where: { tweetId, actorId: userId, type: 'LIKE' },
        });

        await tx.tweet.update({
          where: { id: tweetId },
          data: {
            likeCount: {
              decrement: 1,
            },
          },
        });
      })
      .catch((e) => {
        // record not found
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
          throw new HttpException(
            {
              message: TWEETS_ERROR_MESSAGES.CONFLICTING_LIKE,
              code: TWEETS_ERROR_CODES.CONFLICTING_LIKE,
            },
            HttpStatus.CONFLICT,
          );
        } else {
          throw e;
        }
      });
  }

  async retweetTweet(userId: bigint, tweetId: bigint) {
    await this.prisma
      .$transaction(async (tx) => {
        await tx.retweet.create({
          data: {
            userId,
            tweetId,
          },
        });

        await tx.tweet.update({
          where: { id: tweetId },
          data: {
            retweetCount: {
              increment: 1,
            },
          },
        });
      })
      .catch((e) => {
        //unique constraint
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new HttpException(
            {
              message: TWEETS_ERROR_MESSAGES.CONFLICTING_RETWEET,
              code: TWEETS_ERROR_CODES.CONFLICTING_RETWEET,
            },
            HttpStatus.CONFLICT,
          );
        } else {
          throw e;
        }
      });
  }

  async unretweetTweet(userId: bigint, tweetId: bigint) {
    await this.prisma
      .$transaction(async (tx) => {
        await tx.retweet.delete({
          where: {
            userId_tweetId: {
              userId,
              tweetId,
            },
          },
        });

        await tx.notification.deleteMany({
          where: { tweetId, actorId: userId, type: 'RETWEET' },
        });

        await tx.tweet.update({
          where: { id: tweetId },
          data: {
            retweetCount: {
              decrement: 1,
            },
          },
        });
      })
      .catch((e) => {
        //record not found
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
          throw new HttpException(
            {
              message: TWEETS_ERROR_MESSAGES.CONFLICTING_RETWEET,
              code: TWEETS_ERROR_CODES.CONFLICTING_RETWEET,
            },
            HttpStatus.CONFLICT,
          );
        } else {
          throw e;
        }
      });
  }

  async hasUserLikedTweet(userId: bigint, tweetId: bigint): Promise<boolean> {
    const like = await this.prisma.like.findUnique({
      where: {
        userId_tweetId: {
          userId,
          tweetId,
        },
      },
    });
    return !!like;
  }

  async hasUserRetweetedTweet(userId: bigint, tweetId: bigint): Promise<boolean> {
    const retweet = await this.prisma.retweet.findUnique({
      where: {
        userId_tweetId: {
          userId,
          tweetId,
        },
      },
    });
    return !!retweet;
  }

  async getDetailedTweetById(
    tweetId: bigint,
    currentUserId: bigint,
  ): Promise<GetTweetResponseDto | null> {
    const tweet = await this.prisma.tweet.findUnique({
      where: { id: tweetId, isDeleted: false },
      include: {
        ...tweetInclude(currentUserId),
      },
    });

    if (!tweet) {
      return null;
    }

    // Manually fetch quoted tweet to handle deleted state
    let quotedTweetForMapping: BaseTweetWithIncludes | { isDeleted: true } | null = null;

    if (tweet.quotedTweetId) {
      const quotedTweetCheck = await this.prisma.tweet.findUnique({
        where: { id: tweet.quotedTweetId },
        select: { id: true, isDeleted: true },
      });

      if (quotedTweetCheck && quotedTweetCheck.isDeleted) {
        quotedTweetForMapping = { isDeleted: true };
      } else if (quotedTweetCheck && !quotedTweetCheck.isDeleted) {
        quotedTweetForMapping = await this.prisma.tweet.findUnique({
          where: { id: tweet.quotedTweetId },
          include: tweetInclude(currentUserId),
        });
      }
    }

    const tweetWithQuoted = {
      ...tweet,
      quotedTweet: quotedTweetForMapping,
    } as DetailedTweetWithIncludes;

    return this.mapToDetailedTweetDto(tweetWithQuoted);
  }

  /**
   * Get a tweet by ID, returning a deleted marker if the tweet is deleted
   * Used for root tweets and quoted tweets
   */
  async getTweetOrDeleted(tweetId: bigint, currentUserId: bigint): Promise<TweetOrDeleted | null> {
    const tweetCheck = await this.prisma.tweet.findUnique({
      where: { id: tweetId },
      select: { id: true, isDeleted: true },
    });

    if (!tweetCheck) {
      return null;
    }

    if (tweetCheck.isDeleted) {
      return { isDeleted: true };
    }

    // Fetch full tweet data if not deleted
    const tweet = await this.prisma.tweet.findUnique({
      where: { id: tweetId, isDeleted: false },
      include: {
        ...tweetInclude(currentUserId),
      },
    });

    return tweet ? this.mapToTweetDto(tweet) : null;
  }

  /**
   * Get all parent tweets of a given tweet using recursive CTE (max depth is 4)
   *
   * @param replyToTweetId - ID of the direct parent tweet of the tweet to get parents for
   * @param currentUserId - ID of the current user (for context)
   *
   * @returns an array of parent tweets (excluding the root tweet)
   */
  async getParentTweets(replyToTweetId: bigint, currentUserId: bigint, rootTweetId: bigint | null) {
    // Get all parent Ids with recursive CTE
    const parentIds = await this.prisma.$queryRaw<
      { id: bigint; depth: number; is_deleted: boolean }[]
    >`
      WITH RECURSIVE parent_tweets AS (
        -- base case: direct parent
        SELECT id, reply_to_tweet_id, root_tweet_id, is_deleted, 1 AS depth
        FROM tweets
        WHERE id = ${replyToTweetId}
        ${rootTweetId ? Prisma.sql`AND id != ${rootTweetId}` : Prisma.empty}
      
        UNION ALL

        -- recursive case: find parent of the current tweet
        SELECT t.id, t.reply_to_tweet_id, t.root_tweet_id, t.is_deleted, pt.depth + 1
        FROM tweets t
        INNER JOIN parent_tweets pt ON t.id = pt.reply_to_tweet_id
        WHERE pt.depth < ${MAX_TWEET_DEPTH} 
        AND pt.reply_to_tweet_id IS NOT NULL
        ${rootTweetId ? Prisma.sql`AND t.id != ${rootTweetId}` : Prisma.empty}
      )
    SELECT id, depth, is_deleted
    FROM parent_tweets
    ORDER BY depth DESC
  `;

    if (parentIds.length === 0) {
      return [];
    }

    const deletedIds = new Set(parentIds.filter((row) => row.is_deleted).map((row) => row.id));
    const activeIds = parentIds.filter((row) => !row.is_deleted).map((row) => row.id);

    // Hydrate non-deleted tweets
    const tweets = await this.prisma.tweet.findMany({
      where: {
        id: { in: activeIds },
        isDeleted: false,
      },
      include: {
        ...tweetInclude(currentUserId),
      },
    });

    // Map tweet id to dto
    const tweetMap = new Map<bigint, TweetDto>();
    tweets.forEach((tweet) => {
      tweetMap.set(tweet.id, this.mapToTweetDto(tweet));
    });

    const result = parentIds.map((row) => {
      if (deletedIds.has(row.id)) {
        return { isDeleted: true } as DeletedTweet;
      }
      return tweetMap.get(row.id)!;
    });
    return result;
  }

  async getReferencedTweet(tweetId: bigint, currentUserId: bigint): Promise<TweetDto | null> {
    const tweet = await this.prisma.tweet.findUnique({
      where: { id: tweetId, isDeleted: false },
      include: {
        ...tweetInclude(currentUserId),
      },
    });

    return tweet ? this.mapToTweetDto(tweet) : null;
  }

  async getTweetQuotes(
    tweetId: bigint,
    currentUserId: bigint,
    limit: number,
    prevCursor: TweetRelationsCursor | undefined,
  ): Promise<TweetDto[]> {
    const quotes = await this.prisma.tweet.findMany({
      where: {
        quotedTweetId: tweetId,
        isDeleted: false,
        user: {
          blockedBy: {
            none: {
              userId: currentUserId,
            },
          },
          mutedBy: {
            none: {
              userId: currentUserId,
            },
          },
        },
      },
      orderBy: [
        {
          createdAt: 'desc',
        },
        { id: 'desc' },
      ],
      include: {
        ...tweetInclude(currentUserId),
        quotedTweet: {
          include: tweetInclude(currentUserId),
        },
      },
      cursor: prevCursor
        ? { id: BigInt(prevCursor.id), createdAt: prevCursor.createdAt }
        : undefined,
      take: limit,
    });

    const quoteDtos = quotes.map((quote) => this.mapToTweetDto(quote));
    return quoteDtos;
  }

  async getTweetReplies(
    tweetId: bigint,
    currentUserId: bigint,
    limit: number,
    prevCursor: TweetRelationsCursor | undefined,
  ): Promise<ReplyTweetDto[]> {
    const replies = await this.prisma.tweet.findMany({
      where: {
        replyToTweetId: tweetId,
        isDeleted: false,
        user: {
          blockedBy: {
            none: {
              userId: currentUserId,
            },
          },
          mutedBy: {
            none: {
              userId: currentUserId,
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        ...tweetInclude(currentUserId),
      },
      cursor: prevCursor
        ? { id: BigInt(prevCursor.id), createdAt: prevCursor.createdAt }
        : undefined,
      take: limit,
    });

    const replyDtos = replies.map((reply) => {
      const baseDto = this.mapToTweetDto(reply);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { quotedTweet, quoteToTweetId, ...replyDto } = baseDto;
      return replyDto as ReplyTweetDto;
    });
    return replyDtos;
  }

  private async getUserInteractionsForTweet(
    model: 'like' | 'retweet',
    tweetId: bigint,
    currentUserId: bigint,
    limit: number,
    prevCursor: UserInteractionsCursor | undefined,
  ) {
    const select = {
      user: {
        select: {
          id: true,
          username: true,
          profile: {
            select: {
              displayName: true,
              avatarUrl: true,
              bio: true,
              bioEntities: true,
            },
          },
          followers: { where: { followerId: currentUserId } },
          following: { where: { followedId: currentUserId } },
          blockedBy: { where: { userId: currentUserId } },
          mutedBy: { where: { userId: currentUserId } },
        },
      },
    } as const;

    const commonQueryArgs = {
      where: { tweetId },
      orderBy: [
        { userId: 'asc' as const },
        { tweetId: 'asc' as const },
        { createdAt: 'desc' as const },
      ],
      select,
      take: limit,
      cursor: prevCursor
        ? {
            userId_tweetId: {
              userId: BigInt(prevCursor.userId),
              tweetId: BigInt(prevCursor.tweetId),
            },
          }
        : undefined,
    };

    const interactions =
      model === 'like'
        ? await this.prisma.like.findMany(commonQueryArgs)
        : await this.prisma.retweet.findMany(commonQueryArgs);

    const rawDtos = interactions.map((record) => {
      const user = record.user;
      const dto = plainToInstance(UserInteractionDto, {
        username: user.username,
        displayName: user.profile?.displayName ?? '',
        avatarUrl: user.profile?.avatarUrl,
        bio: user.profile?.bio
          ? {
              text: user.profile.bio,
              bioEntities: user.profile?.bioEntities as unknown as BioEntitiesDto,
            }
          : null,
        isFollowing: user.followers.length > 0,
        isFollower: user.following.length > 0,
        isBlocked: user.blockedBy.length > 0,
        isMuted: user.mutedBy.length > 0,
      });

      return {
        ...dto,
        userId: user.id.toString(),
      };
    });

    return rawDtos;
  }

  async getTweetRetweeters(
    tweetId: bigint,
    currentUserId: bigint,
    limit: number,
    prevCursor: UserInteractionsCursor | undefined,
  ) {
    return this.getUserInteractionsForTweet('retweet', tweetId, currentUserId, limit, prevCursor);
  }

  async getTweetLikers(
    tweetId: bigint,
    currentUserId: bigint,
    limit: number,
    prevCursor: UserInteractionsCursor | undefined,
  ) {
    return this.getUserInteractionsForTweet('like', tweetId, currentUserId, limit, prevCursor);
  }

  async findTweetById(tweetId: bigint) {
    return this.prisma.tweet.findUnique({
      where: { id: tweetId, isDeleted: false },
    });
  }

  async getFeedSkeletonSQL(
    targetUserId: bigint,
    limit: number,
    cursor: FeedCursor | undefined,
    includeReplies: boolean,
  ): Promise<FeedSkeleton[]> {
    const cursorTime = cursor ? new Date(cursor.createdAt).getTime() : null;
    const cursorId = cursor ? BigInt(cursor.id) : null;

    // 1. Dynamic Filter Logic
    // If includeReplies is TRUE, we want EVERYTHING (empty string).
    // If includeReplies is FALSE, we filter out items that have a parent.
    const replyFilter = includeReplies ? Prisma.sql`` : Prisma.sql`AND "reply_to_tweet_id" IS NULL`;

    // 2. Cursor Logic (The Epoch Math )
    const cursorClause =
      cursor && cursorTime !== null
        ? Prisma.sql`
        AND (
          EXTRACT(EPOCH FROM "created_at") * 1000, 
          "id"
        ) <= (${cursorTime}, ${cursorId})`
        : Prisma.sql``;

    return await this.prisma.$queryRaw<Array<FeedSkeleton>>`
    SELECT * FROM (
      -- 1. Tweets (Applied dynamic filter here)
      SELECT id, "created_at", "is_deleted", 'tweet' as type 
      FROM "tweets"
      WHERE "user_id" = ${targetUserId} 
      AND is_deleted = false
      ${replyFilter}
      
      UNION ALL
      
      -- 2. Reposts (Always included in both tabs usually)
      SELECT "tweet_id" as id, "created_at", false as "is_deleted", 'repost' as type 
      FROM "retweets"
      WHERE "user_id" = ${targetUserId}
    ) AS feed
    WHERE 1=1 ${cursorClause}
    ORDER BY "created_at" DESC, "id" DESC, "type" DESC
    LIMIT ${limit}
  `;
  }

  async hydrateTweetsInList(authUserId: bigint, tweetIds: bigint[]) {
    return await this.prisma.tweet.findMany({
      where: {
        id: { in: tweetIds },
      },
      include: {
        ...tweetInclude(authUserId),
        quotedTweet: {
          include: tweetInclude(authUserId),
        },
        replyToTweet: {
          include: tweetInclude(authUserId),
        },
      },
    });
  }

  async getUserLikedTweets(
    userId: bigint,
    currentUserId: bigint,
    limit: number,
    prevCursor: UserInteractionsCursor | undefined,
  ): Promise<TweetDto[]> {
    const likes = await this.prisma.like.findMany({
      where: {
        userId,
        tweet: {
          isDeleted: false,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { userId: 'asc' }, { tweetId: 'asc' }],
      include: {
        tweet: {
          include: {
            ...tweetInclude(currentUserId),
            quotedTweet: {
              include: tweetInclude(currentUserId),
            },
          },
        },
      },
      cursor: prevCursor
        ? {
            userId_tweetId: {
              userId: BigInt(prevCursor.userId),
              tweetId: BigInt(prevCursor.tweetId),
            },
          }
        : undefined,
      take: limit || 20,
    });

    const tweets = likes
      .filter((like) => like.tweet)
      .map((like) => this.mapToTweetDto(like.tweet as TweetWithIncludes));

    return tweets;
  }

  async getTweetsByIds(tweetIds: bigint[]): Promise<CachedStaticTweet[]> {
    if (tweetIds.length === 0) {
      return [];
    }
    const tweets = await this.prisma.tweet.findMany({
      where: {
        id: { in: tweetIds },
        isDeleted: false,
      },
      include: {
        tweetMentions: {
          select: {
            startPosition: true,
            user: {
              select: {
                username: true,
              },
            },
          },
        },
        tweetHashtags: {
          select: {
            startPosition: true,
            hashtag: {
              select: {
                keyword: true,
              },
            },
          },
        },
        tweetMedia: {
          select: {
            order: true,
            media: {
              select: {
                url: true,
                type: true,
                altText: true,
                width: true,
                height: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    return tweets.map((tweet) => ({
      id: tweet.id.toString(),
      authorId: tweet.userId.toString(),
      content: tweet.content ?? '',
      createdAt: tweet.createdAt,
      entities: {
        mentions: tweet.tweetMentions.map((mention) => ({
          username: mention.user.username,
          startPosition: mention.startPosition,
        })),
        hashtags: tweet.tweetHashtags.map((hashtag) => ({
          hashtag: hashtag.hashtag.keyword,
          startPosition: hashtag.startPosition,
        })),
      },
      media: tweet.tweetMedia?.map((media) => ({
        url: media.media.url,
        type: media.media.type,
        altText: media.media.altText,
        width: media.media.width ?? 0,
        height: media.media.height ?? 0,
      })),
      replyToTweetId: tweet.replyToTweetId?.toString() ?? null,
      quoteToTweetId: tweet.quotedTweetId?.toString() ?? null,
      rootTweetId: tweet.rootTweetId?.toString() ?? null,
      isRepost: false,
      repostedBy: undefined,
    }));
  }

  async getCompactAuthorsByIds(authorIds: Set<bigint>): Promise<CompactAuthorWithId[]> {
    if (authorIds.size === 0) {
      return [];
    }
    const authorIdsArray = Array.from(authorIds);
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: authorIdsArray },
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        profile: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
    return users.map((user) => ({
      id: user.id.toString(),
      username: user.username,
      displayName: user.profile?.displayName ?? '',
      avatarUrl: user.profile?.avatarUrl,
    }));
  }

  async getTweetCounts(
    tweetIds: bigint[],
  ): Promise<Map<string, { likeCounts: number; retweetCounts: number; replyCounts: number }>> {
    if (tweetIds.length === 0) {
      return new Map();
    }
    const tweets = await this.prisma.tweet.findMany({
      where: {
        id: { in: tweetIds },
        isDeleted: false,
      },
      select: {
        id: true,
        likeCount: true,
        retweetCount: true,
        replyCount: true,
      },
    });

    const countsMap = new Map<
      string,
      { likeCounts: number; retweetCounts: number; replyCounts: number }
    >();
    tweets.forEach((tweet) => {
      countsMap.set(tweet.id.toString(), {
        likeCounts: tweet.likeCount,
        retweetCounts: tweet.retweetCount,
        replyCounts: tweet.replyCount,
      });
    });

    return countsMap;
  }

  async getUserTweetInteractions(
    userId: bigint,
    tweetIds: bigint[],
  ): Promise<Map<bigint, { isLiked: boolean; isRetweeted: boolean }>> {
    if (tweetIds.length === 0) {
      return new Map();
    }

    const results = await this.prisma.$queryRaw<
      Array<{
        tweet_id: bigint;
        is_liked: boolean;
        is_retweeted: boolean;
      }>
    >`
    SELECT 
      t.id AS tweet_id,
      EXISTS (
        SELECT 1 FROM likes l WHERE l.tweet_id = t.id AND l.user_id = ${userId}
      ) AS is_liked,
      EXISTS (
        SELECT 1 FROM retweets r WHERE r.tweet_id = t.id AND r.user_id = ${userId}
      ) AS is_retweeted
    FROM tweets t
    WHERE t.id = ANY(${tweetIds}::bigint[]) AND t.is_deleted = false
  `;

    const interactionsMap = new Map();
    for (const row of results) {
      interactionsMap.set(BigInt(row.tweet_id), {
        isLiked: row.is_liked == true,
        isRetweeted: row.is_retweeted,
      });
    }
    return interactionsMap;
  }

  private buildTweetFilters(
    currentUserId: bigint,
    hasMedia: boolean = false,
    excludeMutedAndBlocked: boolean = false,
    peopleFilter: PeopleSearchFilter = PeopleSearchFilter.Anyone,
    cursor?: TweetRelationsCursor,
  ) {
    const cursorCondition = cursor
      ? Prisma.sql`
        AND (
          t.created_at < ${cursor.createdAt}::timestamp
          OR (
            t.created_at = ${cursor.createdAt}::timestamp 
            AND t.id <= ${BigInt(cursor.id)}
          )
        )
      `
      : Prisma.empty;

    const mutedAndBlockedCondition = excludeMutedAndBlocked
      ? Prisma.sql`
        AND NOT EXISTS (
          SELECT 1 
          FROM blocks b 
          WHERE b.user_id = ${currentUserId} AND b.blocked_id = t.user_id
        )
        AND NOT EXISTS (
          SELECT 1 
          FROM mutes m 
          WHERE m.user_id = ${currentUserId} AND m.muted_id = t.user_id
        )
      `
      : Prisma.empty;

    const peopleFilterCondition =
      peopleFilter === PeopleSearchFilter.Following
        ? Prisma.sql`
        AND EXISTS (
          SELECT 1 
          FROM follows f 
          WHERE f.follower_id = ${currentUserId} AND f.followed_id = t.user_id
        )
      `
        : Prisma.empty;

    const mediaCondition = hasMedia ? Prisma.sql`AND t.has_media = true` : Prisma.empty;

    return {
      cursorCondition,
      mutedAndBlockedCondition,
      peopleFilterCondition,
      mediaCondition,
    };
  }

  async getTweetsByQuery(
    currentUserId: bigint,
    query: string,
    hasMedia: boolean = false,
    excludeMutedAndBlocked: boolean = false,
    peopleFilter: PeopleSearchFilter = PeopleSearchFilter.Anyone,
    limit: number,
    cursor?: TweetRelationsCursor,
  ) {
    const { cursorCondition, mutedAndBlockedCondition, peopleFilterCondition, mediaCondition } =
      this.buildTweetFilters(currentUserId, hasMedia, excludeMutedAndBlocked, peopleFilter, cursor);

    const sqlQuery = Prisma.sql`
    SELECT t.id, t.created_at 
    FROM tweets t
    WHERE t.search_document @@ to_tsquery('simple', ${query})
      AND t.is_deleted = false
      ${mediaCondition}
      ${cursorCondition}
      ${mutedAndBlockedCondition}
      ${peopleFilterCondition}
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT ${limit}
  `;

    const tweetIds = await this.prisma.$queryRaw<
      {
        id: bigint;
        created_at: Date;
      }[]
    >(sqlQuery);

    if (tweetIds.length === 0) {
      return [];
    }

    const tweets = await this.prisma.tweet.findMany({
      where: {
        id: { in: tweetIds.map((row) => row.id) },
      },
      include: {
        ...tweetInclude(currentUserId),
        quotedTweet: {
          include: tweetInclude(currentUserId),
        },
        replyToTweet: {
          include: tweetInclude(currentUserId),
        },
      },
    });
    // Maintain the order from the search query
    const tweetMap = new Map(tweets.map((t) => [t.id.toString(), t]));
    const orderedTweets = tweetIds
      .map((row) => tweetMap.get(row.id.toString()))
      .filter((tweet) => tweet !== undefined);

    return orderedTweets.map((tweet) => this.mapToDetailedTweetDto(tweet));
  }

  async getTweetIdsLinkedToHashtag(
    hashtagId: bigint,
    currentUserId: bigint,
    limit: number,
    hasMedia: boolean = false,
    excludeMutedAndBlocked: boolean = false,
    peopleFilter: PeopleSearchFilter = PeopleSearchFilter.Anyone,
    prevCursor?: TweetRelationsCursor,
  ): Promise<bigint[]> {
    const { cursorCondition, mutedAndBlockedCondition, peopleFilterCondition, mediaCondition } =
      this.buildTweetFilters(
        currentUserId,
        hasMedia,
        excludeMutedAndBlocked,
        peopleFilter,
        prevCursor,
      );

    const tweetHashtags = await this.prisma.$queryRaw<
      { id: bigint; created_at: Date }[]
    >(Prisma.sql`
      SELECT t.id, t.created_at
      FROM tweets t
      JOIN tweet_hashtags th ON t.id = th.tweet_id
      WHERE th.hashtag_id = ${hashtagId}
        AND t.is_deleted = false
        ${mediaCondition}
        ${cursorCondition}
        ${mutedAndBlockedCondition}
        ${peopleFilterCondition}
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT ${limit}
    `);

    const tweetIds = tweetHashtags.map((row) => row.id);
    return tweetIds;
  }

  async getTweetsWithReferencesByIds(
    currentUserId: bigint,
    tweetIds: bigint[],
  ): Promise<TweetDto[]> {
    const tweets = await this.prisma.tweet.findMany({
      where: {
        id: { in: tweetIds },
      },
      include: {
        ...tweetInclude(currentUserId),
        quotedTweet: {
          include: tweetInclude(currentUserId),
        },
        replyToTweet: {
          include: tweetInclude(currentUserId),
        },
      },
    });

    // Maintain the order from the hashtag query
    const tweetMap = new Map(tweets.map((t) => [t.id.toString(), t]));
    const orderedTweets = tweetIds
      .map((id) => tweetMap.get(id.toString()))
      .filter((tweet) => tweet !== undefined);

    return orderedTweets.map((tweet) => this.mapToDetailedTweetDto(tweet));
  }

  async getMediaTweetsForUser(
    userId: bigint,
    currentUserId: bigint,
    limit: number,
    prevCursor: TweetRelationsCursor | undefined,
  ): Promise<TweetDto[]> {
    const tweets = await this.prisma.tweet.findMany({
      where: {
        userId,
        isDeleted: false,
        tweetMedia: {
          // TODO replace with has media if fixed
          some: {},
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        ...tweetInclude(currentUserId),
        quotedTweet: {
          include: tweetInclude(currentUserId),
        },
      },
      cursor: prevCursor
        ? {
            id: BigInt(prevCursor.id),
          }
        : undefined,
      take: limit || 20,
    });

    return tweets.map((tweet) => this.mapToTweetDto(tweet));
  }

  /**
   * Filters author IDs to return only those that the user follows and hasn't muted, acc is still active
   * @param userId The user checking their timeline
   * @param authorIds Array of author IDs to validate
   * @returns Array of valid author IDs (followed, not muted, not deleted)
   */
  async filterValidAuthors(userId: bigint, authorIds: bigint[]): Promise<bigint[]> {
    const validFollows = await this.prisma.follow.findMany({
      where: {
        followerId: userId,
        followedId: { in: authorIds },
        // Check that user hasn't muted this author
        followedUser: {
          mutedBy: {
            none: {
              userId: userId,
            },
          },
          deletedAt: null,
        },
      },
      select: {
        followedId: true,
      },
    });

    return validFollows.map((f) => f.followedId);
  }

  /**
   * Filters tweet IDs to return only those not deleted
   * @param tweetIds Array of tweet IDs to validate
   * @returns Array of valid tweet IDs
   */
  async filterValidTweets(tweetIds: bigint[]): Promise<bigint[]> {
    const validTweets = await this.prisma.tweet.findMany({
      where: {
        id: { in: tweetIds },
        isDeleted: false,
        user: {
          deletedAt: null,
        },
      },
      select: {
        id: true,
      },
    });

    return validTweets.map((t) => t.id);
  }

  /**
   * Get recent tweets and retweets from a user (for backfilling timeline)
   */
  async getRecentTweetsFromUser(
    userId: bigint,
    beforeDate: Date,
    limit: number,
  ): Promise<Array<TweetsBackfill>> {
    const result = await this.prisma.$queryRaw<Array<TweetsBackfill>>`
    SELECT * FROM (
      SELECT 
        id,
        user_id as "authorId",
        created_at as "createdAt",
        'T'::text as type,
        NULL::bigint as "retweeterId"
      FROM tweets
      WHERE user_id = ${userId}
        AND created_at < ${beforeDate}::timestamp
        AND is_deleted = false
        AND reply_to_tweet_id IS NULL
      
      UNION ALL
      
      SELECT 
        r.tweet_id as id,
        t.user_id as "authorId",
        r.created_at as "createdAt",
        'R'::text as type,
        r.user_id as "retweeterId"
      FROM retweets r
      INNER JOIN tweets t ON r.tweet_id = t.id
      WHERE r.user_id = ${userId}
        AND r.created_at < ${beforeDate}::timestamp
        AND t.is_deleted = false
    ) AS combined_timeline
    ORDER BY "createdAt" DESC, id DESC
    LIMIT ${limit}
  `;

    return result.map((row) => ({
      id: row.id,
      authorId: row.authorId,
      createdAt: row.createdAt,
      type: row.type,
      retweeterId: row.retweeterId,
    }));
  }
}
