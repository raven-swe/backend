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
    prismaClient: Prisma.TransactionClient = this.prisma,
  ): Promise<bigint[]> {
    if (!hashtags || hashtags.length === 0) {
      return [];
    }

    // for less db work, they are case-insensitive anyways
    const keywords = Array.from(new Set(hashtags.map((hashtag) => hashtag.keyword.toLowerCase())));

    const results = await prismaClient.$queryRaw<{ id: bigint; keyword: string }[]>`
      INSERT INTO "trending_keywords" (keyword, "is_hashtag", count)
      VALUES ${Prisma.join(keywords.map((keyword) => Prisma.sql`(${keyword}, true, 1)`))}
      ON CONFLICT (keyword, "is_hashtag")
      DO UPDATE SET count = "trending_keywords".count + 1
      RETURNING id, keyword
    `;

    const map = new Map<string, bigint>(
      results.map((item) => [item.keyword.toLowerCase(), item.id]),
    );

    // map ids to original input
    // the ! at the end is safe, we are sure all exist
    return hashtags.map((hashtag) => map.get(hashtag.keyword.toLowerCase())!);
  }

  async incrementHashtagCount(
    hashtagIds: bigint[],
    prismaClient: Prisma.TransactionClient = this.prisma,
  ) {
    await prismaClient.trendingKeyword.updateMany({
      where: {
        id: { in: hashtagIds },
      },
      data: {
        count: {
          increment: 1,
        },
      },
    });
  }

  // ---------------
}
