import { Injectable } from '@nestjs/common';
import { Prisma, Categories } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { PlainHashtag } from 'src/tweets/interfaces';

@Injectable()
export class TrendingRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * This function is intended to be called inside a transaction
   * @param hashtags
   * @param prismaClient
   * @returns Array of hashtag ids in the same order as input
   */
  async createOrGetHashtags(
    hashtags: PlainHashtag[],
    prismaClient: Prisma.TransactionClient = this.prisma,
  ): Promise<(PlainHashtag & { hashtagId: bigint })[]> {
    if (!hashtags || hashtags.length === 0) {
      return [];
    }

    // counts once per tweet, lowercase
    const keywords = Array.from(new Set(hashtags.map((hashtag) => hashtag.keyword.toLowerCase())));

    // Create or get hashtags in the new hashtags table (for tweet linking and searching)
    const results = await prismaClient.$queryRaw<{ id: bigint; keyword: string }[]>`
      INSERT INTO "hashtags" (keyword)
      VALUES ${Prisma.join(keywords.map((keyword) => Prisma.sql`(${keyword})`))}
      ON CONFLICT (keyword)
      DO UPDATE SET keyword = EXCLUDED.keyword
      RETURNING id, keyword
    `;

    const keywordToIdMap = new Map<string, bigint>(
      results.map((item) => [item.keyword.toLowerCase(), item.id]),
    );

    // the ! at the end is safe, we are sure all exist
    return hashtags.map((hashtag) => ({
      ...hashtag,
      hashtagId: keywordToIdMap.get(hashtag.keyword.toLowerCase())!,
    }));
  }

  /**
   * Retrieves the ID of a hashtag from the database.
   *
   * @param hashtag - The hashtag to search for, without the leading '#'.
   * @returns - The ID of the hashtag if it exists, or null if it does not.
   */
  async getHashtagId(hashtag: string): Promise<{ id: bigint } | null> {
    return await this.prisma.hashtag.findUnique({
      select: { id: true },
      where: {
        keyword: hashtag.toLowerCase(),
      },
    });
  }

  async scaleDownAllScores(factor: number): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.trendingKeyword.updateMany({
        data: { overallScore: { multiply: factor } },
      }),
      this.prisma.trendingKeywordCategory.updateMany({
        data: { score: { multiply: factor } },
      }),
    ]);
  }

  async findKeywordByKeywordAndType(
    keyword: string,
    isHashtag: boolean,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    return tx.trendingKeyword.findUnique({
      where: { keyword_isHashtag: { keyword, isHashtag } },
      include: { categoryScores: true },
    });
  }

  async createKeywordWithCategories(
    data: {
      keyword: string;
      isHashtag: boolean;
      overallScore: number;
      count: number;
      lastUpdatedAt: Date;
      categoryScores: Prisma.TrendingKeywordCategoryCreateWithoutKeywordInput[];
    },
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    return tx.trendingKeyword.create({
      data: {
        keyword: data.keyword,
        isHashtag: data.isHashtag,
        overallScore: data.overallScore,
        count: data.count,
        lastUpdatedAt: data.lastUpdatedAt,
        categoryScores: { create: data.categoryScores },
      },
    });
  }

  async getTopWords(
    query: string,
    limit: number,
    isHashtagQuery: boolean = false,
  ): Promise<{ keyword: string; isHashtag: boolean }[]> {
    // Escape sql wildcards % and _
    query = query.replace(/[%_]/g, '\\$&');
    const results = await this.prisma.trendingKeyword.findMany({
      where: {
        keyword: {
          startsWith: query.toLowerCase(),
        },
        ...(isHashtagQuery && { isHashtag: true }),
      },
      select: {
        keyword: true,
        isHashtag: true,
      },
      orderBy: { count: 'desc' },
      take: limit,
    });

    return results;
  }

  async upsertKeywordCategory(
    data: {
      trendingKeywordId: bigint;
      category: Categories;
      score: number;
      categoryOccurenceCount: number;
    },
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    return tx.trendingKeywordCategory.upsert({
      where: {
        trendingKeywordId_category: {
          trendingKeywordId: data.trendingKeywordId,
          category: data.category,
        },
      },
      update: {
        score: data.score,
        categoryOccurenceCount: data.categoryOccurenceCount,
      },
      create: {
        trendingKeywordId: data.trendingKeywordId,
        category: data.category,
        score: data.score,
        categoryOccurenceCount: data.categoryOccurenceCount,
      },
    });
  }

  async updateKeyword(
    id: bigint,
    data: { overallScore: number; count: number; lastUpdatedAt: Date },
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    return tx.trendingKeyword.update({
      where: { id },
      data,
    });
  }

  async deleteOldKeywords(cutoffDate: Date): Promise<void> {
    await this.prisma.trendingKeyword.deleteMany({
      where: { lastUpdatedAt: { lt: cutoffDate } },
    });
  }

  async deleteLowScoreCategories(threshold: number): Promise<void> {
    await this.prisma.trendingKeywordCategory.deleteMany({
      where: { score: { lt: threshold } },
    });
  }
}
