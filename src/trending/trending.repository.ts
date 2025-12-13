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
}
