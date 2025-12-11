import { Injectable } from '@nestjs/common';
import { TrendingRepository } from './trending.repository';
import { Prisma } from '@prisma/client';
import { PlainHashtag } from 'src/tweets/interfaces';
import { extractHashtag, isSingleHashtagQuery } from 'src/search/utils/search-query.util';

@Injectable()
export class TrendingService {
  constructor(private readonly TrendingRepository: TrendingRepository) {}

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

  async getHashtagId(hashtag: string): Promise<{ id: bigint } | null> {
    return await this.TrendingRepository.getHashtagId(hashtag);
  }

  async getTrendingWords(query: string, limit: number): Promise<string[]> {
    if (!query || query.trim() === '') {
      return [];
    }

    let isHashtagQuery = false;
    // If the query is a hashtag, remove the leading '#'
    if (isSingleHashtagQuery(query)) {
      isHashtagQuery = true;
      query = extractHashtag(query);
    }

    const hashtags = await this.TrendingRepository.getTopWordsByKeyword(
      query,
      limit,
      isHashtagQuery,
    );
    return hashtags;
  }
}
