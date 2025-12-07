import { Injectable } from '@nestjs/common';
import { TrendingRepository } from './trending.repository';
import { Categories, Prisma } from '@prisma/client';
import { PlainHashtag } from 'src/tweets/interfaces';
import { UpdateTrendScoresDto } from './dtos';
import {
  BATCH_SIZE,
  IGNORING_THRESHOLD,
  RETENTION_HOURS,
  SCALE_DOWN_FACTOR,
} from './constants/trending.constants';
import { PrismaService } from 'src/prisma/prisma.service';

type ModelTopic = { topic: string; trend_score: number; occurence_in_category: number };
type ModelItem = {
  keyword: string;
  top_related_topics: ModelTopic[];
};

@Injectable()
export class TrendingService {
  constructor(
    private readonly TrendingRepository: TrendingRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   *
   * @param hashtags An array of hashtag objects, containing the keyword and the starting position
   * @param tx transaction client passed from the create tweet function in tweet service
   * @returns The actual IDs for the keywords along with the given starting position and keyword, creating new IDs for non-existing keywords
   */
  async createOrIncrementHashtags(
    hashtags: PlainHashtag[],
    tx: Prisma.TransactionClient,
  ): Promise<(PlainHashtag & { hashtagId: bigint })[]> {
    return await this.TrendingRepository.createOrIncrementHashtags(hashtags, tx);
  }

  async updateTrendScores(data: UpdateTrendScoresDto): Promise<{ message: string }> {
    await this.applyModelResults(data);
    return { message: 'Trend scores updated successfully' };
  }

  private async applyModelResults(data: UpdateTrendScoresDto, now = new Date()): Promise<void> {
    const items = data.trending_keywords;

    await this.TrendingRepository.scaleDownAllScores(SCALE_DOWN_FACTOR);

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);

      await this.prisma.$transaction(async (tx) => {
        for (const item of batch) {
          await this.processKeywordItem(item, now, tx);
        }
      });
    }

    const cutoff = new Date(now.getTime() - RETENTION_HOURS * 60 * 60 * 1000);
    await this.TrendingRepository.deleteOldKeywords(cutoff);
    await this.TrendingRepository.deleteLowScoreCategories(IGNORING_THRESHOLD);
  }

  private async processKeywordItem(
    item: ModelItem,
    now: Date,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const keyword = item.keyword;
    const isHashtag = item.keyword.startsWith('#');

    const incomingOcc = item.top_related_topics.reduce(
      (sum, topic) => sum + topic.occurence_in_category,
      0,
    );

    const incomingScoreByCategory = new Map<Categories, number>();
    const incomingOccByCategory = new Map<Categories, number>();

    for (const t of item.top_related_topics ?? []) {
      const catKey = t.topic.toUpperCase() as Categories;

      incomingScoreByCategory.set(
        catKey,
        (incomingScoreByCategory.get(catKey) ?? 0) + t.trend_score,
      );

      incomingOccByCategory.set(
        catKey,
        (incomingOccByCategory.get(catKey) ?? 0) + t.occurence_in_category,
      );
    }

    const existing = await this.TrendingRepository.findKeywordByKeywordAndType(
      keyword,
      isHashtag,
      tx,
    );

    if (!existing) {
      await this.createNewKeyword(
        keyword,
        isHashtag,
        incomingScoreByCategory,
        incomingOccByCategory,
        incomingOcc,
        now,
        tx,
      );
      return;
    }

    await this.updateExistingKeyword(
      existing,
      incomingScoreByCategory,
      incomingOccByCategory,
      incomingOcc,
      now,
      tx,
    );
  }

  private async createNewKeyword(
    keyword: string,
    isHashtag: boolean,
    incomingScoreByCategory: Map<Categories, number>,
    incomingOccByCategory: Map<Categories, number>,
    incomingOcc: number,
    now: Date,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const categoryCreates: Prisma.TrendingKeywordCategoryCreateWithoutKeywordInput[] = Array.from(
      incomingScoreByCategory.keys(),
    ).map((category) => ({
      category,
      score: incomingScoreByCategory.get(category) ?? 0,
      categoryOccurenceCount: incomingOccByCategory.get(category) ?? 0,
    }));

    const overall = categoryCreates.reduce((sum, cat) => sum + (cat.score ?? 0), 0);

    await this.TrendingRepository.createKeywordWithCategories(
      {
        keyword,
        isHashtag,
        overallScore: overall,
        count: incomingOcc,
        lastUpdatedAt: now,
        categoryScores: categoryCreates,
      },
      tx,
    );
  }

  private async updateExistingKeyword(
    existing: {
      id: bigint;
      count: number;
      categoryScores: { category: Categories; score: number; categoryOccurenceCount: number }[];
    },
    incomingScoreByCategory: Map<Categories, number>,
    incomingOccByCategory: Map<Categories, number>,
    incomingOcc: number,
    now: Date,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const existingScoreByCategory = new Map<Categories, number>();
    const existingOccByCategory = new Map<Categories, number>();

    for (const categoryScore of existing.categoryScores) {
      existingScoreByCategory.set(categoryScore.category, categoryScore.score);
      existingOccByCategory.set(categoryScore.category, categoryScore.categoryOccurenceCount);
    }

    const allCategories = new Set<Categories>([
      ...existingScoreByCategory.keys(),
      ...incomingScoreByCategory.keys(),
    ]);

    const updatedCategories: {
      category: Categories;
      score: number;
      occCount: number;
    }[] = [];

    for (const category of allCategories) {
      const oldScore = existingScoreByCategory.get(category) ?? 0;
      const oldOcc = existingOccByCategory.get(category) ?? 0;

      const incomingScore = incomingScoreByCategory.get(category) ?? 0;
      const incomingOccCat = incomingOccByCategory.get(category) ?? 0;

      const newScore = oldScore + incomingScore;
      const newOccCount = oldOcc + incomingOccCat;

      updatedCategories.push({
        category,
        score: newScore,
        occCount: newOccCount,
      });
    }

    const newOverall = updatedCategories.reduce((sum, x) => sum + x.score, 0);
    const newOccurrence = (existing.count || 0) + incomingOcc;

    for (const updatedCategory of updatedCategories) {
      await this.TrendingRepository.upsertKeywordCategory(
        {
          trendingKeywordId: existing.id,
          category: updatedCategory.category,
          score: updatedCategory.score,
          categoryOccurenceCount: updatedCategory.occCount,
        },
        tx,
      );
    }

    await this.TrendingRepository.updateKeyword(
      existing.id,
      {
        overallScore: newOverall,
        count: newOccurrence,
        lastUpdatedAt: now,
      },
      tx,
    );
  }
}
