import { Injectable } from '@nestjs/common';
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
import { CompactAuthorDto } from './dtos/compact-author.dto';
import { DynamicDataFromCache } from './timeline/interfaces/DynamicDataFromCache.interface';
import { TIMELINE_MAX_SIZE } from './timeline/constants';

const tweetInclude = (currentUserId: bigint) =>
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
  ) {
    // get followed users
    const followedUnMutedUserIds = await this.prisma.follow.findMany({
      where: {
        followerId: userId,
        followedUser: {
          mutedBy: { none: { userId } },
        },
      },
      select: { followedId: true },
    });
    const followedUserIds = followedUnMutedUserIds.map((follow) => follow.followedId);

    // The timeline consists of tweets from followed users plus the user's own tweets.
    const timelineUserIds = [...followedUserIds, userId];

    const tweets = await this.prisma.tweet.findMany({
      where: {
        userId: { in: timelineUserIds },
        isDeleted: false,
        replyToTweetId: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        ...tweetInclude(userId),
        quotedTweet: {
          include: tweetInclude(userId),
        },
      },
      cursor: cursor ? { createdAt: new Date(cursor.createdAt), id: BigInt(cursor.id) } : undefined, // id as a tiebreaker
      take: limit || TIMELINE_MAX_SIZE,
    });

    return tweets.map((tweet) => this.mapToTweetDto(tweet));
  }

  mapToTweetDto(tweet: TweetWithIncludes): TweetDto {
    return {
      id: tweet.id.toString(),
      author: {
        id: tweet.user.id.toString(),
        username: tweet.user.username,
        displayName: tweet.user.profile?.displayName ?? '',
        avatarUrl: tweet.user.profile?.avatarUrl,
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
      quotedTweet: tweet.quotedTweet ? this.mapToTweetDto(tweet.quotedTweet) : undefined,
    };
  }

  async create(tweetData: CreateTweetData, prismaClient: Prisma.TransactionClient = this.prisma) {
    return prismaClient.tweet.create({
      data: {
        userId: tweetData.userId,
        content: tweetData.content,
        replyToTweetId: tweetData.replyToTweetId,
        quotedTweetId: tweetData.quotedTweetId,
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

  async checkExistingTweet(tweetId: bigint): Promise<boolean> {
    const tweet = await this.prisma.tweet.findUnique({
      where: { id: tweetId, isDeleted: false },
      select: { id: true },
    });
    return !!tweet;
  }

  async checkTweetOwnership(tweetId: bigint, userId: bigint): Promise<boolean> {
    const tweet = await this.prisma.tweet.findUnique({
      where: { id: tweetId, userId, isDeleted: false },
      select: { id: true },
    });
    return !!tweet;
  }

  async deleteTweet(tweetId: bigint) {
    await this.prisma.tweet.update({
      where: { id: tweetId },
      data: { isDeleted: true }, //:))
    });
  }

  private mapToDetailedTweetDto(
    tweet: DetailedTweetWithIncludes,
  ): TweetDto & { replyToTweet?: TweetDto } {
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
    await this.prisma.$transaction(async (tx) => {
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
    });
  }

  async unlikeTweet(userId: bigint, tweetId: bigint) {
    await this.prisma.$transaction(async (tx) => {
      await tx.like.delete({
        where: {
          userId_tweetId: {
            userId,
            tweetId,
          },
        },
      });

      await tx.tweet.update({
        where: { id: tweetId },
        data: {
          likeCount: {
            decrement: 1,
          },
        },
      });
    });
  }

  async retweetTweet(userId: bigint, tweetId: bigint) {
    await this.prisma.$transaction(async (tx) => {
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
    });
  }

  async unretweetTweet(userId: bigint, tweetId: bigint) {
    await this.prisma.$transaction(async (tx) => {
      await tx.retweet.delete({
        where: {
          userId_tweetId: {
            userId,
            tweetId,
          },
        },
      });

      await tx.tweet.update({
        where: { id: tweetId },
        data: {
          retweetCount: {
            decrement: 1,
          },
        },
      });
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
        quotedTweet: {
          include: tweetInclude(currentUserId),
        },
        replyToTweet: {
          include: tweetInclude(currentUserId),
        },
      },
    });

    return tweet ? (this.mapToDetailedTweetDto(tweet) as GetTweetResponseDto) : null;
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
      SELECT id, "created_at", 'tweet' as type 
      FROM "tweets"
      WHERE "user_id" = ${targetUserId} 
      ${replyFilter}
      
      UNION ALL
      
      -- 2. Reposts (Always included in both tabs usually)
      SELECT "tweet_id" as id, "created_at", 'repost' as type 
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
    }));
  }

  async getCompactAuthorsByIds(authorIds: Set<bigint>): Promise<CompactAuthorDto[]> {
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

  async getTweetDynamicDataForUser(
    missingLikeCounts: Array<bigint>,
    missingRetweetCounts: Array<bigint>,
    missingReplyCounts: Array<bigint>,
    missingInteractionLikes: Array<bigint>,
    missingInteractionRetweets: Array<bigint>,
    userId: bigint,
  ): Promise<DynamicDataFromCache> {
    const likeCounts = new Map<bigint, number>();
    const retweetCounts = new Map<bigint, number>();
    const replyCounts = new Map<bigint, number>();
    const userTweetInteractions = new Map<bigint, { liked: boolean; retweeted: boolean }>();

    // all can be done in one query
    const results = await this.prisma.$queryRaw<
      Array<{
        tweet_id: bigint;
        like_count: number;
        retweet_count: number;
        reply_count: number;
        is_liked: boolean;
        is_retweeted: boolean;
      }>
    >`
      SELECT 
        t.id AS tweet_id,
        t.like_count,
        t.retweet_count,
        t.reply_count,
        EXISTS (
          SELECT 1 FROM likes l WHERE l.tweet_id = t.id AND l.user_id = ${userId}
        ) AS is_liked,
        EXISTS (
          SELECT 1 FROM retweets r WHERE r.tweet_id = t.id AND r.user_id = ${userId}
        ) AS is_retweeted
      FROM tweets t
      WHERE t.id = ANY(${[
        ...new Set([
          ...missingLikeCounts,
          ...missingRetweetCounts,
          ...missingInteractionLikes,
          ...missingInteractionRetweets,
        ]),
      ]}::bigint[])
    `;

    for (const row of results) {
      const tweetId = row.tweet_id;

      if (missingLikeCounts.includes(tweetId)) {
        likeCounts.set(tweetId, Number(row.like_count));
      }

      if (missingRetweetCounts.includes(tweetId)) {
        retweetCounts.set(tweetId, Number(row.retweet_count));
      }

      if (missingReplyCounts.includes(tweetId)) {
        replyCounts.set(tweetId, Number(row.reply_count));
      }

      if (
        missingInteractionLikes.includes(tweetId) ||
        missingInteractionRetweets.includes(tweetId)
      ) {
        userTweetInteractions.set(tweetId, {
          liked: row.is_liked,
          retweeted: row.is_retweeted,
        });
      }
    }

    return { likeCounts, retweetCounts, replyCounts, userTweetInteractions };
  }
}
