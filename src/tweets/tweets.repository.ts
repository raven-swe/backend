import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTweetData } from './interfaces/create-tweet-data.interface';

@Injectable()
export class TweetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(tweetData: CreateTweetData, prismaClient: Prisma.TransactionClient = this.prisma) {
    return prismaClient.tweet.create({
      data: {
        userId: tweetData.userId,
        content: tweetData.content,
        replyToTweetId: tweetData.replyToTweetId,
        quotedTweetId: tweetData.quotedTweetId,
        hasMentions: tweetData.Mentions.length > 0,
        hasHashtags: tweetData.Hashtags.length > 0,
        tweetMentions: {
          createMany: {
            data: tweetData.Mentions,
          },
        },
        tweetHashtags: {
          createMany: {
            data: tweetData.Hashtags,
          },
        },
      },
    });
  }
  //--------------------------------------
}
