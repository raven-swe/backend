import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { TweetsRepository } from './tweets.repository';
import { TWEETS_ERROR_CODES, TWEETS_ERROR_MESSAGES } from './constants';
import { UsersRepository } from 'src/users/users.repository';
import {
  decodeCompositeCursor,
  decodeCursor,
  paginateComposite,
  paginateSingle,
} from 'src/common/utils';
import { GetTweetResponseDto } from './dtos/get-tweet-response.dto';
import { TweetRelationsCursor, UserInteractionsCursor } from 'src/common/types/cursors';

@Injectable()
export class TweetsService {
  private readonly logger = new Logger(TweetsService.name);

  constructor(
    private readonly tweetsRepository: TweetsRepository,
    private readonly usersRepository: UsersRepository,
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
  // --------------------------------------

  async likeTweet(userId: bigint, tweetId: bigint) {
    const tweet = await this.checkIfTweetExists(tweetId);

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
    await this.checkIfTweetExists(tweetId);

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
    const tweet = await this.checkIfTweetExists(tweetId);

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

  // --------------------------------------
  async getTweet(tweetId: bigint, currentUserId: bigint): Promise<GetTweetResponseDto | null> {
    const tweet = await this.tweetsRepository.getDetailedTweetById(tweetId, currentUserId);

    if (!tweet) {
      throw new HttpException(
        {
          message: TWEETS_ERROR_MESSAGES.TWEET_NOT_FOUND,
          code: TWEETS_ERROR_CODES.TWEET_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return tweet;
  }

  async getTweetQuotes(
    tweetId: bigint,
    currentUserId: bigint,
    limit: number = 20,
    prevCursor?: string,
  ) {
    return this.getTweetRelations('quotes', tweetId, currentUserId, limit, prevCursor);
  }

  getTweetReplies(tweetId: bigint, currentUserId: bigint, limit: number = 20, prevCursor?: string) {
    return this.getTweetRelations('replies', tweetId, currentUserId, limit, prevCursor);
  }

  async getTweetRetweeters(
    tweetId: bigint,
    currentUserId: bigint,
    limit: number,
    prevCursor?: string,
  ) {
    return this.getTweetUserInteractions('retweets', tweetId, currentUserId, limit, prevCursor);
  }

  async getTweetLikers(tweetId: bigint, currentUserId: bigint, limit: number, prevCursor?: string) {
    return this.getTweetUserInteractions('likes', tweetId, currentUserId, limit, prevCursor);
  }

  async getTweetRelations(
    type: 'replies' | 'quotes',
    tweetId: bigint,
    currentUserId: bigint,
    limit: number,
    prevCursor?: string,
  ) {
    await this.checkIfTweetExists(tweetId);

    let decodedCursor: TweetRelationsCursor | undefined;
    if (prevCursor) {
      try {
        decodedCursor = decodeCompositeCursor<TweetRelationsCursor>(prevCursor);
      } catch {
        throw new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.INVALID_CURSOR,
            code: TWEETS_ERROR_CODES.INVALID_CURSOR,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const items =
      type === 'replies'
        ? await this.tweetsRepository.getTweetReplies(
            tweetId,
            currentUserId,
            limit + 1,
            decodedCursor,
          )
        : await this.tweetsRepository.getTweetQuotes(
            tweetId,
            currentUserId,
            limit + 1,
            decodedCursor,
          );

    const pagination = paginateComposite(items, limit, prevCursor, (relation) => ({
      createdAt: relation.createdAt,
      id: relation.id.toString(),
    }));

    this.logger.log(`Fetched ${items.length} ${type} for tweet ID: ${tweetId}`);

    return { items, pagination };
  }

  private async getTweetUserInteractions(
    type: 'likes' | 'retweets',
    tweetId: bigint,
    currentUserId: bigint,
    limit: number,
    prevCursor?: string,
  ) {
    await this.checkIfTweetExists(tweetId);

    let decodedCursor: UserInteractionsCursor | undefined;
    if (prevCursor) {
      try {
        decodedCursor = decodeCompositeCursor<UserInteractionsCursor>(prevCursor);
      } catch {
        throw new HttpException(
          {
            message: TWEETS_ERROR_MESSAGES.INVALID_CURSOR,
            code: TWEETS_ERROR_CODES.INVALID_CURSOR,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const items =
      type === 'likes'
        ? await this.tweetsRepository.getTweetLikers(
            tweetId,
            currentUserId,
            limit + 1,
            decodedCursor,
          )
        : await this.tweetsRepository.getTweetRetweeters(
            tweetId,
            currentUserId,
            limit + 1,
            decodedCursor,
          );

    const pagination = paginateComposite(items, limit, prevCursor, (interaction) => ({
      userId: interaction.userId.toString(),
      tweetId: tweetId.toString(),
    }));

    this.logger.log(`Fetched ${items.length} ${type} for tweet ID: ${tweetId}`);

    return { items, pagination };
  }

  async checkIfTweetExists(tweetId: bigint) {
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
    return tweet;
  }
}
