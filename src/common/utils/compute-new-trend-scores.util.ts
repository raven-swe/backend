import { PrismaClient, Categories, Prisma } from '@prisma/client';
const prisma = new PrismaClient();

type ModelTopic = { topic: string; trend_score: number; occurence_in_category: number };
type ModelItem = {
  keyword: string;
  top_related_topics: ModelTopic[];
};

const SCALE_DOWN_FACTOR = 0.9;
const RETENTION_HOURS = 24;
const IGNORING_THRESHOLD = 0.05;

export async function applyModelResults(
  data: { trendingKeywords: ModelItem[]; batch_meta: { total_tweets: number } },
  now = new Date(),
) {
  const BATCH = 200;
  const items = data.trendingKeywords;

  await prisma.trendingKeyword.updateMany({
    data: {
      overallScore: { multiply: SCALE_DOWN_FACTOR },
    },
  });

  await prisma.trendingKeywordCategory.updateMany({
    data: {
      score: { multiply: SCALE_DOWN_FACTOR },
    },
  });

  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);

    await prisma.$transaction(async (tx) => {
      for (const item of batch) {
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

        const existing = await tx.trendingKeyword.findUnique({
          where: { keyword_isHashtag: { keyword, isHashtag } },
          include: { categoryScores: true },
        });

        if (!existing) {
          const categoryCreates: Prisma.TrendingKeywordCategoryCreateWithoutKeywordInput[] =
            Array.from(incomingScoreByCategory.keys()).map((category) => ({
              category,
              score: incomingScoreByCategory.get(category) ?? 0,
              categoryOccurenceCount: incomingOccByCategory.get(category) ?? 0,
            }));

          const overall = categoryCreates.reduce((sum, cat) => sum + (cat.score ?? 0), 0);

          await tx.trendingKeyword.create({
            data: {
              keyword,
              isHashtag,
              overallScore: overall,
              count: incomingOcc,
              lastUpdatedAt: now,
              categoryScores: { create: categoryCreates },
            },
          });

          continue;
        }

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
          await tx.trendingKeywordCategory.upsert({
            where: {
              trendingKeywordId_category: {
                trendingKeywordId: existing.id,
                category: updatedCategory.category,
              },
            },
            update: {
              score: updatedCategory.score,
              categoryOccurenceCount: updatedCategory.occCount,
            },
            create: {
              trendingKeywordId: existing.id,
              category: updatedCategory.category,
              score: updatedCategory.score,
              categoryOccurenceCount: updatedCategory.occCount,
            },
          });
        }

        await tx.trendingKeyword.update({
          where: { id: existing.id },
          data: {
            overallScore: newOverall,
            count: newOccurrence,
            lastUpdatedAt: now,
          },
        });
      }
    });
  }

  const cutoff = new Date(now.getTime() - RETENTION_HOURS * 60 * 60 * 1000);
  await prisma.trendingKeyword.deleteMany({
    where: { lastUpdatedAt: { lt: cutoff } },
  });
  await prisma.trendingKeywordCategory.deleteMany({
    where: { score: { lt: IGNORING_THRESHOLD } },
  });
}
