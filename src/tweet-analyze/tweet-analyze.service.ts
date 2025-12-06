import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { TweetAnalyzeRepository } from './tweet-analyze.repository';
import { ClassificationRequest, ClassificationResponse, ClassifiedTweet } from './interfaces';
import { firstValueFrom } from 'rxjs';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class TweetAnalyzeService implements OnModuleInit {
  private readonly logger = new Logger(TweetAnalyzeService.name);
  private readonly classifyEnabled: boolean;
  private readonly intervalMinutes: number;
  private readonly requestLimit: number;
  private readonly classificationApiUrl: string;
  private readonly LOCK_KEY = 'tweet-analyze:lock';
  private readonly LOCK_TTL_SECONDS = 300; // 5 minutes

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly repository: TweetAnalyzeRepository,
    private readonly redisService: RedisService,
  ) {
    this.classifyEnabled = this.configService.get<string>('CLASSIFY_TWEETS') === 'true';
    this.intervalMinutes = parseInt(
      this.configService.get<string>('CLASSIFICATION_INTERVAL_MINUTES') || '5',
    );
    this.requestLimit = parseInt(this.configService.get<string>('CLASSIFY_REQ_LIMIT') || '50');
    this.classificationApiUrl = this.configService.get<string>(
      'CLASSIFICATION_API_URL',
      '/analyze',
    );

    this.logger.log(
      `Tweet Analyze Service initialized - Enabled: ${this.classifyEnabled}, ` +
        `Interval: ${this.intervalMinutes} minutes, Request Limit: ${this.requestLimit}`,
    );
  }

  onModuleInit() {
    if (this.classifyEnabled) {
      const intervalMs = this.intervalMinutes * 60 * 1000;
      this.logger.log(
        `Starting classification cron job with ${this.intervalMinutes} minute interval`,
      );

      setInterval(() => {
        this.classifyTweets().catch((error) => {
          this.logger.error(
            'Error occurred during scheduled tweet classification',
            error instanceof Error ? error.stack : String(error),
          );
        });
      }, intervalMs);
    } else {
      this.logger.log('Classification job is disabled');
    }
  }

  async classifyTweets() {
    if (!this.classifyEnabled) {
      this.logger.debug('Tweet classification is disabled, skipping...');
      return;
    }

    // Try to acquire distributed lock
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      this.logger.debug('Another instance is already running classification job, skipping...');
      return;
    }

    this.logger.log('Starting tweet classification job...');

    try {
      const tweetsToClassify = await this.getTweetsToClassify();

      if (tweetsToClassify.length === 0) {
        this.logger.log('No tweets to classify');
        return;
      }

      this.logger.log(`Found ${tweetsToClassify.length} tweets to classify`);

      const batches = this.splitIntoBatches(tweetsToClassify, this.requestLimit);

      this.logger.log(`Processing ${batches.length} batch(es) with limit ${this.requestLimit}`);

      let allBatchesSucceeded = true;
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        this.logger.log(`Processing batch ${i + 1}/${batches.length} with ${batch.length} tweets`);

        try {
          await this.processBatch(batch);
          this.logger.log(`Batch ${i + 1}/${batches.length} completed successfully`);
        } catch (error) {
          this.logger.error(
            `Failed to process batch ${i + 1}/${batches.length}`,
            error instanceof Error ? error.stack : String(error),
          );
          this.logger.warn(
            `Stopping classification job after batch ${i + 1} failure. ` +
              `${batches.length - i - 1} remaining batch(es) will be retried in next run.`,
          );
          allBatchesSucceeded = false;
          break;
        }
      }

      if (allBatchesSucceeded) {
        this.logger.log('Tweet classification job completed successfully');
      } else {
        this.logger.warn('Tweet classification job stopped due to batch failure');
      }
    } catch (error) {
      this.logger.error(
        'Tweet classification job failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      // Always release the lock when done
      await this.releaseLock();
    }
  }

  private async acquireLock(): Promise<boolean> {
    try {
      const redis = this.redisService.getClient();
      const result = await redis.set(
        this.LOCK_KEY,
        Date.now().toString(),
        'EX',
        this.LOCK_TTL_SECONDS,
        'NX',
      );
      return result === 'OK';
    } catch (error) {
      this.logger.error(
        'Failed to acquire lock',
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  private async releaseLock(): Promise<void> {
    try {
      await this.redisService.del(this.LOCK_KEY);
      this.logger.debug('Released classification lock');
    } catch (error) {
      this.logger.error(
        'Failed to release lock',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async getTweetsToClassify(): Promise<Array<{ id: bigint; content: string }>> {
    const tweets = await this.repository.findTweetsToClassify();

    return tweets.filter((tweet) => tweet.content !== null) as Array<{
      id: bigint;
      content: string;
    }>;
  }

  private splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private async processBatch(tweets: Array<{ id: bigint; content: string }>): Promise<void> {
    const requestPayload: ClassificationRequest = {
      tweets: tweets.map((tweet) => ({
        id: tweet.id.toString(),
        content: tweet.content,
      })),
    };

    this.logger.debug(
      `Sending ${tweets.length} tweets to classification API: ${this.classificationApiUrl}`,
    );

    const response = await firstValueFrom(
      this.httpService.post<ClassificationResponse>(this.classificationApiUrl, requestPayload),
    );

    const classifiedTweets = response.data.tweets_detail;

    if (!classifiedTweets || classifiedTweets.length === 0) {
      this.logger.warn('Classification API returned no results');
      return;
    }

    this.logger.log(`Received ${classifiedTweets.length} classified tweets from API`);

    await this.updateTweetClassifications(classifiedTweets);
  }

  private async updateTweetClassifications(
    classifiedTweets: Array<ClassifiedTweet>,
  ): Promise<void> {
    for (const classified of classifiedTweets) {
      try {
        const tweetId = BigInt(classified.id);
        await this.repository.updateTweetClass(tweetId, classified.class);

        this.logger.debug(`Updated tweet ${classified.id} with class: ${classified.class}`);
      } catch (error) {
        this.logger.error(
          `Failed to update tweet ${classified.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    this.logger.log(`Successfully updated ${classifiedTweets.length} tweets`);
  }
}
