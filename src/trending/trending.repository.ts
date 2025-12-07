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
  async createOrIncrementHashtags(
    hashtags: PlainHashtag[],
    prismaClient: Prisma.TransactionClient = this.prisma,
  ): Promise<(PlainHashtag & { hashtagId: bigint })[]> {
    if (!hashtags || hashtags.length === 0) {
      return [];
    }

    // counts once per tweet, lowercase
    const keywords = Array.from(new Set(hashtags.map((hashtag) => hashtag.keyword.toLowerCase())));

    const results = await prismaClient.$queryRaw<{ id: bigint; keyword: string }[]>`
      INSERT INTO "trending_keywords" (keyword, "is_hashtag", count)
      VALUES ${Prisma.join(keywords.map((keyword) => Prisma.sql`(${keyword}, true, 1)`))}
      ON CONFLICT (keyword, "is_hashtag")
      DO UPDATE SET count = "trending_keywords".count + 1
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
