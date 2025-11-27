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
import { PeopleSearchFilter } from 'src/search/dtos';

const tweetInclude = (currentUserId: bigint) =>
  ({
    user: {
      select: {
        username: true,
        profile: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
        blockedBy: {
          where: { userId: currentUserId },
        },
        followers: {
          where: { followerId: currentUserId },
        },
        following: {
          where: { followedId: currentUserId },
        },
        mutedBy: {
          where: { userId: currentUserId },
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

  async getTimelineForUser(userId: bigint, cursor: string | undefined, limit: number) {
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
      cursor: cursor ? { id: BigInt(cursor) } : undefined,
      take: limit || 20,
    });

    return tweets.map((tweet) => this.mapToTweetDto(tweet));
  }

  mapToTweetDto(tweet: TweetWithIncludes): TweetDto {
    return {
      id: tweet.id.toString(),
      author: {
        username: tweet.user.username,
        displayName: tweet.user.profile?.displayName ?? '',
        avatarUrl: tweet.user.profile?.avatarUrl,
        relationship: {
          blocking: tweet.user.blockedBy.length > 0,
          following: tweet.user.followers.length > 0,
          follower: tweet.user.following.length > 0,
          muted: tweet.user.mutedBy.length > 0,
        },
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
    await this.prisma.$transaction(async (tx) => {
      await tx.tweet.update({
        where: { id: tweetId },
        data: { isDeleted: true },
      });

      await tx.retweet.deleteMany({
        where: {
          tweetId,
        },
      });

      await tx.like.deleteMany({
        where: {
          tweetId,
        },
      });
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

  async getTweetsByQuery(
    currentUserId: bigint,
    query: string,
    hasMedia: boolean = false,
    excludeMutedAndBlocked: boolean = false,
    peopleFilter: PeopleSearchFilter = PeopleSearchFilter.Anyone,
    limit: number,
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

    // Exclude tweets from muted and blocked users if the flag is set
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

    const sqlQuery = Prisma.sql`
    SELECT t.id, t.created_at 
    FROM tweets t
    WHERE t.search_document @@ to_tsquery('simple', ${query})
      AND t.is_deleted = false
      ${hasMedia ? Prisma.sql`AND t.has_media = true` : Prisma.empty}
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
}
