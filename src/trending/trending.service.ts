import { Injectable } from '@nestjs/common';
import { Hashtag } from 'src/common/interfaces/hashtag-interface';
import { CreateHashtagData } from 'src/tweets/interfaces/create-tweet-data.interface';
import { TrendingRepository } from './trending.repository';
import { Prisma } from '@prisma/client';

@Injectable()
export class TrendingService {
  constructor(private readonly TrendingRepository: TrendingRepository) {}

  async getOrCreateHashtagIds(
    hashtags: Hashtag[],
    tx: Prisma.TransactionClient,
  ): Promise<CreateHashtagData[]> {
    const hashtagIds = await this.TrendingRepository.getOrCreateHashtagIds(hashtags, tx);
    return hashtags.map((hashtag, i) => {
      return { hashtagId: hashtagIds[i], startPosition: hashtag.startingIndex };
    });
  }
}
