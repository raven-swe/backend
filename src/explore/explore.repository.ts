import { Injectable } from '@nestjs/common';
import { Categories } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { TweetDto } from 'src/tweets/dtos';
import { tweetInclude, TweetsRepository, TweetWithIncludes } from 'src/tweets/tweets.repository';

@Injectable()
export class ExploreRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tweetsRepository: TweetsRepository,
  ) {}

  /**
   * Fetches top N tweets per category for the given interests using LATERAL join
   * More efficient than ROW_NUMBER - stops scanning after finding N tweets per category
   */
  async getTweetsByCategories(
    currentUserId: bigint,
    categories: string[],
    limitPerCategory: number = 5,
  ): Promise<Map<string, TweetDto[]>> {
    if (categories.length === 0) {
      return new Map();
    }

    // LATERAL join - efficiently gets top N per category without scanning entire dataset
    const rankedTweetIds = await this.prisma.$queryRaw<{ id: bigint; class: string }[]>`
      SELECT t.id, t.class
      FROM UNNEST(${categories}::text[]) AS category(name)
      CROSS JOIN LATERAL (
        SELECT t.id, t.class
        FROM tweets t
        INNER JOIN users u ON t.user_id = u.id
        WHERE t.class = category.name
          AND t.is_deleted = false
          AND t.reply_to_tweet_id IS NULL
          AND u.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM blocks b 
            WHERE (b.user_id = ${currentUserId} AND b.blocked_id = u.id)
            OR (b.user_id = u.id AND b.blocked_id = ${currentUserId})
          )
          AND NOT EXISTS (
            SELECT 1 FROM mutes m 
            WHERE m.user_id = ${currentUserId} AND m.muted_id = u.id
          )
        ORDER BY t.created_at DESC
        LIMIT ${limitPerCategory}
      ) t
    `;

    if (rankedTweetIds.length === 0) {
      return new Map();
    }

    const tweetIds = rankedTweetIds.map((t) => t.id);
    const tweets = await this.prisma.tweet.findMany({
      where: { id: { in: tweetIds } },
      include: {
        ...tweetInclude(currentUserId),
        quotedTweet: {
          include: tweetInclude(currentUserId),
        },
      },
    });

    const categoryMap = new Map<string, TweetDto[]>();
    const tweetMap = new Map(tweets.map((t) => [t.id.toString(), t]));

    for (const category of categories) {
      categoryMap.set(category.toLowerCase(), []);
    }

    for (const { id, class: category } of rankedTweetIds) {
      const tweet = tweetMap.get(id.toString());
      if (tweet) {
        const categoryKey = category.toLowerCase();
        const categoryTweets = categoryMap.get(categoryKey) ?? [];
        categoryTweets.push(this.tweetsRepository.mapToTweetDto(tweet as TweetWithIncludes));
        categoryMap.set(categoryKey, categoryTweets);
      }
    }

    return categoryMap;
  }

  async getTrendingKeywords() {
    const keywords = await this.prisma.trendingKeyword.findMany({
      orderBy: { overallScore: 'desc' },
      take: 30,
      include: {
        categoryScores: {
          orderBy: { score: 'desc' },
          take: 1,
        },
      },
    });

    return keywords.map((keyword) => ({
      ...keyword,
      topCategory: keyword.categoryScores[0],
    }));
  }

  async getEntertainmentKeywords() {
    const keywords = await this.prisma.trendingKeywordCategory.findMany({
      where: { category: Categories.ENTERTAINMENT },
      orderBy: { score: 'desc' },
      take: 30,
      include: {
        keyword: {
          select: {
            keyword: true,
            isHashtag: true,
          },
        },
      },
    });

    return keywords.map((k) => ({
      ...k,
      keyword: k.keyword.keyword,
      isHashtag: k.keyword.isHashtag,
    }));
  }

  async getNewsKeywords() {
    const keywords = await this.prisma.trendingKeywordCategory.findMany({
      where: { category: Categories.NEWS },
      orderBy: { score: 'desc' },
      take: 30,
      include: {
        keyword: {
          select: {
            keyword: true,
            isHashtag: true,
          },
        },
      },
    });

    return keywords.map((k) => ({
      ...k,
      keyword: k.keyword.keyword,
      isHashtag: k.keyword.isHashtag,
    }));
  }

  async getSportsKeywords() {
    const keywords = await this.prisma.trendingKeywordCategory.findMany({
      where: { category: Categories.SPORTS },
      orderBy: { score: 'desc' },
      take: 30,
      include: {
        keyword: {
          select: {
            keyword: true,
            isHashtag: true,
          },
        },
      },
    });

    return keywords.map((k) => ({
      ...k,
      keyword: k.keyword.keyword,
      isHashtag: k.keyword.isHashtag,
    }));
  }
}
