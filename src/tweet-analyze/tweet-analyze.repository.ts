import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TweetAnalyzeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findTweetsToClassify(): Promise<Array<{ id: bigint; content: string | null }>> {
    return await this.prisma.tweet.findMany({
      where: {
        class: null,
        NOT: {
          OR: [{ content: null }, { content: '' }],
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

  async classifyEmptyContentTweets(): Promise<number> {
    const result = await this.prisma.tweet.updateMany({
      where: {
        class: null,
        OR: [{ content: null }, { content: '' }],
        isDeleted: false,
      },
      data: {
        class: 'General',
      },
    });
    return result.count;
  }

  async getLastClassifiedTweetId(): Promise<bigint | null> {
    const lastTweet = await this.prisma.tweet.findFirst({
      where: {
        class: { not: null },
        isDeleted: false,
      },
      orderBy: {
        id: 'desc',
      },
      select: {
        id: true,
      },
    });
    return lastTweet?.id ?? null;
  }

  async findTweetsToClassifyFromCursor(
    cursorId: bigint | null,
  ): Promise<Array<{ id: bigint; content: string | null }>> {
    return await this.prisma.tweet.findMany({
      where: {
        id: cursorId ? { gt: cursorId } : undefined,
        class: null,
        NOT: {
          OR: [{ content: null }, { content: '' }],
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
}
