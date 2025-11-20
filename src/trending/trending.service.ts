import { Injectable } from '@nestjs/common';
import { TrendingRepository } from './trending.repository';
import { Prisma } from '@prisma/client';
import { PlainHashtag, Hashtag } from 'src/tweets/interfaces';

@Injectable()
export class TrendingService {
  constructor(private readonly TrendingRepository: TrendingRepository) {}

  /**
   *
   * @param hashtags An array of hashtag objects, containing the keyword and the starting position
   * @param tx transaction client passed from the create tweet function in tweet service
   * @returns The actual IDs for the keywords along with the given starting position, creating new IDs for non-existing keywords
   */
  async getOrCreateHashtagIds(
    hashtags: PlainHashtag[],
    tx: Prisma.TransactionClient,
  ): Promise<Hashtag[]> {
    const hashtagIds = await this.TrendingRepository.getOrCreateHashtagIds(hashtags, tx);
    return hashtags.map((hashtag, i) => {
      return { hashtagId: hashtagIds[i], startPosition: hashtag.startPosition };
    });
  }
}
