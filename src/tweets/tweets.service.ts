import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { TweetsRepository } from './tweets.repository';
import { TWEETS_ERROR_CODES, TWEETS_ERROR_MESSAGES } from './constants';
import { decodeCursor, paginateSingle } from 'src/common/utils';
import { CreateTweetDto } from './dtos/create-tweet.dto';
import { TrendingService } from 'src/trending/trending.service';
import { parseContent } from 'src/common/utils/parse-content.util';
import { UsersRepository } from 'src/users/users.repository';
import { Hashtag, Mention, CreateTweetData, PlainHashtag, PlainMention } from './interfaces';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TweetsService {
  private readonly logger = new Logger(TweetsService.name);

  constructor(
    private readonly tweetsRepository: TweetsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly trendingService: TrendingService,
    private readonly prisma: PrismaService,
  ) {}

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

  async createTweet(createTweetDto: CreateTweetDto, userId: bigint): Promise<{ message: string }> {
    this.logger.log(`tweet content: ${createTweetDto.content}`);
    const parsedContent = parseContent(createTweetDto.content);
    this.logger.log(`Parsed mentions: ${JSON.stringify(parsedContent.mentions)}`);
    this.logger.log(`Parsed hashtags: ${JSON.stringify(parsedContent.hashtags)}`);
    await this.prisma.$transaction(async (tx) => {
      const mentions = await this.checkUsernamesExistence(parsedContent.mentions, tx);
      const hashtags = await this.getHashtagIds(parsedContent.hashtags, tx);
      console.log('Final mentions with IDs:', mentions);
      const tweetData: CreateTweetData = {
        userId,
        content: createTweetDto.content,
        replyToTweetId: createTweetDto.replyToTweetId
          ? BigInt(createTweetDto.replyToTweetId)
          : null,
        quotedTweetId: createTweetDto.quoteToTweetId ? BigInt(createTweetDto.quoteToTweetId) : null,
        Mentions: mentions,
        Hashtags: hashtags,
      };

      await this.tweetsRepository.create(tweetData, tx);
    });
    return { message: 'Tweet created successfully' };
  }

  /**
   *
   * @param usernames array of mentions (usernames and starting positions)
   * @param tx transaction client passed from the create tweet function in tweet service
   * @returns a new array of mention IDs of real existing users
   */
  private async checkUsernamesExistence(
    mentions: PlainMention[],
    tx: Prisma.TransactionClient,
  ): Promise<Mention[]> {
    return await this.usersRepository.checkUsernamesExistenceAndReplaceIds(mentions, tx);
  }

  /**
   *
   * @param hashtags array of hashtags (tags and starting positions)
   * @param tx transaction client passed from the create tweet function in tweet service
   * @returns a new array of hashtag IDs (existing or newly created)
   */
  private async getHashtagIds(
    hashtags: PlainHashtag[],
    tx: Prisma.TransactionClient,
  ): Promise<Hashtag[]> {
    if (!hashtags || hashtags.length === 0) {
      return [];
    }
    return this.trendingService.getOrCreateHashtagIds(hashtags, tx);
  }
  // --------------------------------------

  async likeTweet(userId: bigint, tweetId: bigint) {
    // Check if tweet exists
    const tweet = await this.tweetsRepository.findTweetById(tweetId);
    if (!tweet || tweet.isDeleted) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
          code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // Check for blocks
    if (userId !== tweet.userId) {
      const isBlocked = await this.usersRepository.areUsersBlocked(userId, tweet.userId);
      if (isBlocked) {
        throw new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.USER_BLOCKED,
            code: TWEETS_ERROR_CODES.USER_BLOCKED,
          },
          HttpStatus.FORBIDDEN,
        );
      }
    }

    // Tweet already liked by user
    const hasLiked = await this.tweetsRepository.hasUserLikedTweet(userId, tweetId);
    if (hasLiked) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.CONFLICTING_LIKE,
          code: TWEETS_ERROR_CODES.CONFLICTING_LIKE,
        },
        HttpStatus.CONFLICT,
      );
    }

    await this.tweetsRepository.likeTweet(userId, tweetId);
    this.logger.log(`User ${userId} liked tweet ${tweetId} successfully`);

    return { message: 'Tweet liked successfully' };
  }

  async unlikeTweet(userId: bigint, tweetId: bigint) {
    // Check if tweet exists
    const tweet = await this.tweetsRepository.findTweetById(tweetId);
    if (!tweet || tweet.isDeleted) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
          code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // Tweet already not liked by user
    const hasLiked = await this.tweetsRepository.hasUserLikedTweet(userId, tweetId);
    if (!hasLiked) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.CONFLICTING_LIKE,
          code: TWEETS_ERROR_CODES.CONFLICTING_LIKE,
        },
        HttpStatus.CONFLICT,
      );
    }

    await this.tweetsRepository.unlikeTweet(userId, tweetId);

    this.logger.log(`User ${userId} unliked tweet ${tweetId} successfully`);
    return { message: 'Tweet unliked successfully' };
  }

  async retweetTweet(userId: bigint, tweetId: bigint) {
    // Check if tweet exists
    const tweet = await this.tweetsRepository.findTweetById(tweetId);
    if (!tweet || tweet.isDeleted) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
          code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // Check for blocks
    if (userId !== tweet.userId) {
      const isBlocked = await this.usersRepository.areUsersBlocked(userId, tweet.userId);
      if (isBlocked) {
        throw new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.USER_BLOCKED,
            code: TWEETS_ERROR_CODES.USER_BLOCKED,
          },
          HttpStatus.FORBIDDEN,
        );
      }
    }

    // Tweet already retweeted by user
    const hasRetweeted = await this.tweetsRepository.hasUserRetweetedTweet(userId, tweetId);
    if (hasRetweeted) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.CONFLICTING_RETWEET,
          code: TWEETS_ERROR_CODES.CONFLICTING_RETWEET,
        },
        HttpStatus.CONFLICT,
      );
    }

    await this.tweetsRepository.retweetTweet(userId, tweetId);
    this.logger.log(`User ${userId} retweeted tweet ${tweetId} successfully`);

    return { message: 'Tweet retweeted successfully' };
  }

  async unretweetTweet(userId: bigint, tweetId: bigint) {
    // Check if tweet exists
    const tweet = await this.tweetsRepository.findTweetById(tweetId);
    if (!tweet) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
          code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // Tweet already not retweeted by user
    const hasRetweeted = await this.tweetsRepository.hasUserRetweetedTweet(userId, tweetId);
    if (!hasRetweeted) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.CONFLICTING_RETWEET,
          code: TWEETS_ERROR_CODES.CONFLICTING_RETWEET,
        },
        HttpStatus.CONFLICT,
      );
    }

    await this.tweetsRepository.unretweetTweet(userId, tweetId);
    this.logger.log(`User ${userId} unretweeted tweet ${tweetId} successfully`);

    return { message: 'Tweet unretweeted successfully' };
  }
}
