import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Hashtag } from 'src/common/interfaces/hashtag-interface';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TrendingRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * This function is intended to be called inside a transaction.
   * Upserts hashtags and returns their ids.
   * @param hashtags
   * @param prismaClient
   * @returns Array of hashtag ids in the same order as input
   */
  async getOrCreateHashtagIds(
    hashtags: Hashtag[],
    prismaClient: Prisma.TransactionClient,
  ): Promise<bigint[]> {
    if (!hashtags || hashtags.length === 0) {
      return [];
    }

    // for less db work, they are case-insensitive anyways
    const keywords = Array.from(new Set(hashtags.map((hashtag) => hashtag.tag.toLowerCase())));

    const results = await Promise.all(
      keywords.map(async (keyword) => {
        return await prismaClient.trendingKeyword.upsert({
          where: {
            keyword_isHashtag: {
              keyword,
              isHashtag: true,
            },
          },
          update: {
            count: { increment: 1 },
          },
          create: {
            keyword,
            isHashtag: true,
            count: 1,
          },
          select: { id: true, keyword: true },
        });
      }),
    );

    // Create a map for quick lookup
    const map = new Map<string, bigint>(
      results.map((item) => [item.keyword.toLowerCase(), item.id]),
    );

    // map ids to original input
    // the ! at the end is safe, we are sure all exist
    return hashtags.map((hashtag) => map.get(hashtag.tag.toLowerCase())!);
  }

  // ---------------
}
