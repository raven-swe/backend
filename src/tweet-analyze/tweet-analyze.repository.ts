import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TweetAnalyzeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findTweetsToClassify(): Promise<Array<{ id: bigint; content: string | null }>> {
    return await this.prisma.tweet.findMany({
      where: {
        class: null,
        content: {
          not: null,
        },
        isDeleted: false,
      },
      orderBy: {
        id: 'asc',
      },
      select: {
        id: true,
        content: true,
      },
    });
  }

  async updateTweetClass(tweetId: bigint, tweetClass: string): Promise<void> {
    await this.prisma.tweet.update({
      where: {
        id: tweetId,
      },
      data: {
        class: tweetClass,
      },
    });
  }
}
