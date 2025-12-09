import { Injectable } from '@nestjs/common';
import { Categories } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ExploreRepository {
  constructor(private readonly prisma: PrismaService) {}

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
          },
        },
      },
    });

    return keywords.map((k) => ({
      ...k,
      keyword: k.keyword.keyword,
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
          },
        },
      },
    });

    return keywords.map((k) => ({
      ...k,
      keyword: k.keyword.keyword,
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
          },
        },
      },
    });

    return keywords.map((k) => ({
      ...k,
      keyword: k.keyword.keyword,
    }));
  }
}
