import { Injectable } from '@nestjs/common';
import { CreateTweetDto } from './dtos/create-tweet.dto';
import { TweetDto } from './dtos/tweet.dto';
import { TweetsRepository } from './tweets.repository';
import { TrendingService } from 'src/trending/trending.service';
import { parseContent } from 'src/common/utils/parse-content.util';
import { UsersRepository } from 'src/users/users.repository';
import { Mention } from 'src/common/interfaces/mention-interface';
import { CreateHashtagData, CreateMentionData } from './interfaces/create-tweet-data.interface';
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

  async createTweet(createTweetDto: CreateTweetDto, userId: bigint): Promise<TweetDto> {
    const parsedContent = parseContent(createTweetDto.content);
    await this.prisma.$transaction(async (tx) => {
      const mentions = await this.checkUsernamesExistence(parsedContent.mentions, tx);
      const hashtags = await this.getHashtagIds(parsedContent.hashtags, tx);
    });
  }

  /**
   *
   * @param usernames array of mentions
   * @returns a new array of mentions or real existing users
   */
  private async checkUsernamesExistence(
    mentions: Mention[],
    tx: Prisma.TransactionClient,
  ): Promise<CreateMentionData[]> {
    return await this.usersRepository.checkUsernamesExistenceAndReplaceIds(mentions, tx);
  }

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
