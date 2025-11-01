import { Injectable, Logger } from '@nestjs/common';
import { TweetsRepository } from './tweets.repository';

@Injectable()
export class TweetsService {
  logger = new Logger(TweetsService.name);

  constructor(private readonly tweetsRepository: TweetsRepository) {}

  async getTimeline(userId: bigint) {
    this.logger.log(`Fetching FULL timeline for user ID: ${userId}`);
    return this.tweetsRepository.getTimelineForUser(userId);
  }
  // --------------------------------------
}
