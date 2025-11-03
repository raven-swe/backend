import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { TweetDto } from './dtos/tweet.dto';
import { DEFAULT_PROFILE_PICTURE } from 'src/users/constants/users';

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
        startingIndex: true,
        user: {
          select: {
            username: true,
          },
        },
      },
    },
    tweetHashtags: {
      select: {
        startingIndex: true,
        hashtag: {
          select: {
            keyword: true,
          },
        },
      },
    },
  }) satisfies Prisma.TweetInclude;

type BaseTweetWithIncludes = Prisma.TweetGetPayload<{
  include: ReturnType<typeof tweetInclude>;
}>;

type TweetWithIncludes = BaseTweetWithIncludes & {
  quotedTweet?: (BaseTweetWithIncludes & { quotedTweet?: null }) | null;
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
      take: limit,
    });

    return tweets.map((tweet) => this.mapToTweetDto(tweet));
  }

  private mapToTweetDto(tweet: TweetWithIncludes): TweetDto {
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
          startPosition: mention.startingIndex,
        })),
        hashtags: tweet.tweetHashtags.map((hashtag) => ({
          hashtag: hashtag.hashtag.keyword,
          startPosition: hashtag.startingIndex,
        })),
      },
      media: [],
      replyToTweetId: tweet.replyToTweetId?.toString() ?? null,
      quoteToTweetId: tweet.quotedTweetId?.toString() ?? null,
      quotedTweet: tweet.quotedTweet ? this.mapToTweetDto(tweet.quotedTweet) : undefined,
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

  async findTweetById(tweetId: bigint) {
    return this.prisma.tweet.findUnique({
      where: { id: tweetId },
    });
  }

  async getLikedTweetsByUsername(
    currentUserId: bigint,
    username: string,
    blockedUserIds: bigint[],
    limit: number = 20,
    cursor?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!user) return [];

    const blockedSet = new Set(blockedUserIds);
    const validTweetIds: bigint[] = [];
    let currentCursor = cursor;
    const batchSize = 50; // Fetch in batches

    // Keep fetching until we have enough valid tweets or run out of likes
    while (validTweetIds.length < limit) {
      const likes = await this.prisma.like.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        cursor: currentCursor
          ? { userId_tweetId: { userId: user.id, tweetId: BigInt(currentCursor) } }
          : undefined,
        take: batchSize,
        select: {
          tweetId: true,
          tweet: {
            select: {
              userId: true,
              isDeleted: true,
            },
          },
        },
      });

      // No more likes available
      if (likes.length === 0) break;

      // Filter valid tweets
      for (const like of likes) {
        if (!like.tweet.isDeleted && !blockedSet.has(like.tweet.userId)) {
          validTweetIds.push(like.tweetId);
          if (validTweetIds.length >= limit) break;
        }
      }

      // Update cursor for next iteration
      const lastLike = likes[likes.length - 1];
      currentCursor = lastLike.tweetId.toString();

      // If we got fewer results than batch size, we've reached the end
      if (likes.length < batchSize) break;
    }

    if (validTweetIds.length === 0) return [];

    // Fetch full tweet details for valid tweets
    const tweets = await this.prisma.tweet.findMany({
      where: {
        id: { in: validTweetIds },
      },
      include: {
        ...tweetInclude(currentUserId),
        quotedTweet: { include: tweetInclude(currentUserId) },
      },
    });

    // Sort tweets by the order of validTweetIds to maintain chronological order
    const tweetMap = new Map(tweets.map((t) => [t.id, t]));
    const sortedTweets = validTweetIds
      .map((id) => tweetMap.get(id))
      .filter((t): t is NonNullable<typeof t> => t !== undefined);

    return sortedTweets.map((tweet) => this.mapToTweetDto(tweet));
  }
}
