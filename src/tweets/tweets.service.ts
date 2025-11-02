import { Injectable, Logger } from '@nestjs/common';
import { TweetsRepository } from './tweets.repository';
import { decodeCursor, paginateSingle } from 'src/common/utils/cursor-pagination.util';

@Injectable()
export class TweetsService {
  logger = new Logger(TweetsService.name);

  constructor(private readonly tweetsRepository: TweetsRepository) {}

  async getTimeline(userId: bigint, cursor: string, limit: number) {
    this.logger.log(`Fetching following timeline for user ID: ${userId}`);
    const id = decodeCursor(cursor);
    const timeline = await this.tweetsRepository.getTimelineForUser(userId, id, limit + 1);
    const validTweets = timeline.filter((tweet) => tweet !== undefined);

    const pagination = paginateSingle(validTweets, limit, cursor, (tweet) => tweet.id.toString());
    return {
      items: validTweets,
      pagination,
    };
  }
  // --------------------------------------
}
