import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserInteractionDto, TweetDto } from './dtos';
import { DEFAULT_PROFILE_PICTURE } from 'src/users/constants/users';
import { GetTweetResponseDto } from './dtos/get-tweet-response.dto';
import { UserInteractionsCursor, TweetRelationsCursor } from 'src/common/types/cursors';
import { BioEntitiesDto } from 'src/users/dtos';
import { plainToInstance } from 'class-transformer';
import { ReplyTweetDto } from './dtos/reply-tweet.dto';

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
    const followedUsers = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followedId: true },
    });
    const followedUserIds = followedUsers.map((follow) => follow.followedId);

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

  public mapToTweetDto(tweet: TweetWithIncludes): TweetDto {
    return {
      id: tweet.id.toString(),
      author: {
        username: tweet.user.username,
        displayName: tweet.user.profile?.displayName ?? '',
        avatarUrl: tweet.user.profile?.avatarUrl ?? DEFAULT_PROFILE_PICTURE,
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

  private mapToDetailedTweetDto(
    tweet: DetailedTweetWithIncludes,
  ): TweetDto & { replyToTweet?: TweetDto } {
    const baseTweet = this.mapToTweetDto(tweet);

    return {
      ...baseTweet,
      replyToTweet: tweet.replyToTweet ? this.mapToTweetDto(tweet.replyToTweet) : undefined,
    };
  }

  //--------------------------------------
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
      orderBy: {
        likeCount: 'desc',
        createdAt: 'desc',
      },
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
      skip: prevCursor ? 1 : 0,
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
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        ...tweetInclude(currentUserId),
      },
      cursor: prevCursor
        ? { id: BigInt(prevCursor.id), createdAt: prevCursor.createdAt }
        : undefined,
      take: limit,
      skip: prevCursor ? 1 : 0,
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
  ): Promise<UserInteractionDto[]> {
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
    };

    const commonQueryArgs = {
      where: { tweetId, userId: { not: currentUserId } },
      orderBy: { createdAt: 'desc' } as const,
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
      skip: prevCursor ? 1 : 0,
    };

    const interactions =
      model === 'like'
        ? await this.prisma.like.findMany(commonQueryArgs)
        : await this.prisma.retweet.findMany(commonQueryArgs);

    const rawDtos = interactions.map((record) => {
      const user = record.user;
      return {
        userId: user.id.toString(),
        username: user.username,
        displayName: user.profile?.displayName ?? '',
        avatarUrl: user.profile?.avatarUrl ?? DEFAULT_PROFILE_PICTURE,
        bio:
          user.profile?.bio && user.profile?.bioEntities
            ? {
                text: user.profile.bio,
                bioEntities: user.profile.bioEntities as unknown as BioEntitiesDto,
              }
            : null,
        isFollowing: user.followers.length > 0,
        isFollower: user.following.length > 0,
        isBlocked: user.blockedBy.length > 0,
        isMuted: user.mutedBy.length > 0,
      };
    });
    return plainToInstance(UserInteractionDto, rawDtos);
  }

  async getTweetRetweeters(
    tweetId: bigint,
    currentUserId: bigint,
    limit: number,
    prevCursor: UserInteractionsCursor | undefined,
  ): Promise<UserInteractionDto[]> {
    return this.getUserInteractionsForTweet('retweet', tweetId, currentUserId, limit, prevCursor);
  }

  async getTweetLikers(
    tweetId: bigint,
    currentUserId: bigint,
    limit: number,
    prevCursor: UserInteractionsCursor | undefined,
  ): Promise<UserInteractionDto[]> {
    return this.getUserInteractionsForTweet('like', tweetId, currentUserId, limit, prevCursor);
  }

  async findTweetById(tweetId: bigint) {
    return this.prisma.tweet.findUnique({
      where: { id: tweetId, isDeleted: false },
    });
  }
}
