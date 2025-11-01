import { Injectable } from '@nestjs/common';
import { CreateTweetDto } from './dtos/create-tweet.dto';
import { TweetsRepository } from './tweets.repository';
import { TrendingService } from 'src/trending/trending.service';
import { parseContent } from 'src/common/utils/parse-content.util';
import { UsersRepository } from 'src/users/users.repository';
import { Mention } from 'src/common/interfaces/mention-interface';
import {
  CreateHashtagData,
  CreateMentionData,
  CreateTweetData,
} from './interfaces/create-tweet-data.interface';
import { Hashtag } from 'src/common/interfaces/hashtag-interface';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
@Injectable()
export class TweetsService {
  constructor(
    private readonly tweetsRepository: TweetsRepository,
    private readonly trendingService: TrendingService,
    private readonly usersRepository: UsersRepository,
    private readonly prisma: PrismaService,
  ) {}

  async createTweet(createTweetDto: CreateTweetDto, userId: bigint): Promise<{ message: string }> {
    console.log('tweet content:', createTweetDto);
    const parsedContent = parseContent(createTweetDto.content);
    await this.prisma.$transaction(async (tx) => {
      const mentions = await this.checkUsernamesExistence(parsedContent.mentions, tx);
      const hashtags = await this.getHashtagIds(parsedContent.hashtags, tx);

      const tweetData: CreateTweetData = {
        userId,
        content: createTweetDto.content,
        replyToTweetId: createTweetDto.replyToTweetId
          ? BigInt(createTweetDto.replyToTweetId)
          : null,
        quotedTweetId: createTweetDto.quotedTweetId ? BigInt(createTweetDto.quotedTweetId) : null,
        Mentions: mentions,
        Hashtags: hashtags,
      };

      await this.tweetsRepository.create(tweetData, tx);
    });
    return { message: 'Tweet created successfully' };
  }

  /**
   *
   * @param usernames array of mentions
   * @param tx transaction client
   * @returns a new array of mentions or real existing users
   */
  private async checkUsernamesExistence(
    mentions: Mention[],
    tx: Prisma.TransactionClient,
  ): Promise<CreateMentionData[]> {
    return await this.usersRepository.checkUsernamesExistenceAndReplaceIds(mentions, tx);
  }

  /**
   *
   * @param hashtags array of hashtags
   * @param tx transaction client
   * @returns a new array of hashtags with their ids, after upsert
   */
  private async getHashtagIds(
    hashtags: Hashtag[],
    tx: Prisma.TransactionClient,
  ): Promise<CreateHashtagData[]> {
    if (!hashtags || hashtags.length === 0) {
      return [];
    }
    return this.trendingService.getOrCreateHashtagIds(hashtags, tx);
  }

  // --------------------------------------
}
