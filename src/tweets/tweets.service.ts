import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { TweetsRepository } from './tweets.repository';
import { TWEETS_ERROR_CODES, TWEETS_ERROR_MESSAGES } from './constants';
import { decodeCursor, paginateSingle } from 'src/common/utils';
import { CreateTweetDto } from './dtos/create-tweet.dto';
import { ContentParsingService } from 'src/content-parsing/content-parsing.service';
import { UsersRepository } from 'src/users/users.repository';
import { CreateTweetData, Hashtag, Mention } from './interfaces';
import { PrismaService } from 'src/prisma/prisma.service';
import { Tweet } from '@prisma/client';
import { MediaRepository } from 'src/media/media.repository';
import { CreatedTweetDto } from './dtos/created-tweet.dto';

@Injectable()
export class TweetsService {
  private readonly logger = new Logger(TweetsService.name);

  constructor(
    private readonly tweetsRepository: TweetsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly contentParsingService: ContentParsingService,
    private readonly mediaRepository: MediaRepository,
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

  async createTweet(createTweetDto: CreateTweetDto, userId: bigint): Promise<CreatedTweetDto> {
    if (createTweetDto.replyToTweetId && createTweetDto.quoteToTweetId) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.INVALID_TWEET_CREATION,
          code: TWEETS_ERROR_CODES.INVALID_TWEET_CREATION,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!createTweetDto.content && (!createTweetDto.media || createTweetDto.media.length === 0)) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.INVALID_TWEET_PAYLOAD,
          code: TWEETS_ERROR_CODES.INVALID_TWEET_PAYLOAD,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (createTweetDto.media && createTweetDto.media.length > 4) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.TOO_MANY_MEDIA,
          code: TWEETS_ERROR_CODES.TOO_MANY_MEDIA,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    let mediaIds: bigint[] = [];
    if (createTweetDto.media && createTweetDto.media.length > 0) {
      mediaIds = createTweetDto.media.map((id) => BigInt(id));
    }

    await this.checkReplyAndQuoteTweetsExist(
      createTweetDto.replyToTweetId,
      createTweetDto.quoteToTweetId,
    );
    await this.validateMediaExists(mediaIds);

    const { tweet, mentions, hashtags } = await this.prisma.$transaction(async (tx) => {
      const { mentions, hashtags } = await this.contentParsingService.parseContentAndValidate(
        createTweetDto.content,
        tx,
      );
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

      const tweet = await this.tweetsRepository.create(tweetData, tx);
      await this.tweetsRepository.linkTweetMedia(tweet.id, mediaIds, tx);

      await this.mediaRepository.markMediaAsNotPending(mediaIds);
      return { tweet, mentions, hashtags };
    });

    const returnedTweet = this.formatTweetCreationResponse(
      tweet,
      mentions,
      hashtags,
      createTweetDto.media,
      createTweetDto.replyToTweetId,
      createTweetDto.quoteToTweetId,
    );
    return { ...returnedTweet };
  }

  async deleteTweet(tweetId: bigint, userId: bigint) {
    if (!(await this.tweetsRepository.checkExistingTweet(tweetId))) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
          code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (!(await this.tweetsRepository.checkTweetOwnership(tweetId, userId))) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.TWEET_FORBIDDEN_DELETION,
          code: TWEETS_ERROR_CODES.TWEET_FORBIDDEN_DELETION,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    await this.tweetsRepository.deleteTweet(tweetId);
    this.logger.log(`User ${userId} deleted tweet ${tweetId} successfully`);
    return { message: 'Tweet deleted successfully' };
  }

  private formatTweetCreationResponse(
    tweet: Tweet,
    mentions: Mention[],
    hashtags: Hashtag[],
    media: string[] | undefined,
    replyToTweetId: string | undefined,
    quoteToTweetId: string | undefined,
  ) {
    return {
      id: tweet.id.toString(),
      content: tweet.content || undefined,
      media: media,
      entities: {
        mentions: mentions.map((mention) => ({ ...mention, userId: mention.userId.toString() })),
        hashtags: hashtags.map((hashtag) => ({
          ...hashtag,
          hashtagId: hashtag.hashtagId.toString(),
        })),
      },
      replyToTweetId,
      quoteToTweetId,
      createdAt: tweet.createdAt,
    };
  }

  private async checkReplyAndQuoteTweetsExist(
    replyToTweetId: string | undefined,
    quoteToTweetId: string | undefined,
  ) {
    if (
      replyToTweetId &&
      !(await this.tweetsRepository.checkExistingTweet(BigInt(replyToTweetId)))
    ) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
          code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (
      quoteToTweetId &&
      !(await this.tweetsRepository.checkExistingTweet(BigInt(quoteToTweetId)))
    ) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
          code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async validateMediaExists(mediaIds: bigint[]) {
    if (mediaIds.length === 0) {
      return;
    }
    const allExist = await this.mediaRepository.checkMediaExists(mediaIds);
    if (!allExist) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.INVALID_MEDIA,
          code: TWEETS_ERROR_CODES.INVALID_MEDIA,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
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
