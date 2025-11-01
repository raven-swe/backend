import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { TweetsRepository } from './tweets.repository';
import { TWEETS_ERROR_CODES, TWEETS_ERROR_MESSAGES } from './constants/tweets.constant';
import { UsersRepository } from 'src/users/users.repository';

@Injectable()
export class TweetsService {
  // --------------------------------------
  private readonly logger = new Logger(TweetsService.name);

  constructor(
    private readonly tweetsRepository: TweetsRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

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
    if (userId !== tweet.id) {
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
    if (userId !== tweet.id) {
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

  // --------------------------------------
}
