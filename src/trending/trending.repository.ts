import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
  async getOrCreateHashtagIds(
    hashtags: PlainHashtag[],
    prismaClient: Prisma.TransactionClient,
  ): Promise<bigint[]> {
    if (!hashtags || hashtags.length === 0) {
      return [];
    }

    // for less db work, they are case-insensitive anyways
    const keywords = Array.from(new Set(hashtags.map((hashtag) => hashtag.keyword.toLowerCase())));

    const existing = await prismaClient.trendingKeyword.findMany({
      where: { keyword: { in: keywords }, isHashtag: true },
      select: { id: true, keyword: true },
    });

    const map = new Map<string, bigint>(
      existing.map((item) => [item.keyword.toLowerCase(), item.id]),
    );
    const missing = keywords.filter((keyword) => !map.has(keyword));

    if (missing.length > 0) {
      await prismaClient.trendingKeyword.createMany({
        data: missing.map((keyword) => ({
          keyword,
          isHashtag: true,
          count: 1,
        })),
        skipDuplicates: true,
      });

      // there is no other way to do this in a transaction without a refetch
      const newlyAddedTags = await prismaClient.trendingKeyword.findMany({
        where: { keyword: { in: missing }, isHashtag: true },
        select: { id: true, keyword: true },
      });

      newlyAddedTags.forEach((item) => map.set(item.keyword.toLowerCase(), item.id));
    }

    // map ids to original input
    // the ! at the end is safe, we are sure all exist
    return hashtags.map((hashtag) => map.get(hashtag.keyword.toLowerCase())!);
  }

  // ---------------
}
