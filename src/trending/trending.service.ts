import { Injectable } from '@nestjs/common';
import { TrendingRepository } from './trending.repository';
import { Prisma } from '@prisma/client';
import { PlainHashtag } from 'src/tweets/interfaces';
import { applyModelResults } from 'src/common/utils/compute-new-trend-scores.util';
import { UpdateTrendScoresDto } from './dtos';

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

  async getTrendingHashtags(query: string, limit: number): Promise<string[]> {
    if (!query || query.trim() === '') {
      return [];
    }

    const hashtags = await this.TrendingRepository.getTopHashtagsByKeyword(query, limit);
    return hashtags;
  }

  async updateTrendScores(data: UpdateTrendScoresDto): Promise<{ message: string }> {
    await applyModelResults(data);
    return { message: 'Trend scores updated successfully' };
  }
}
