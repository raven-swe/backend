import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { TweetAnalyzeRepository } from './tweet-analyze.repository';
import {
  ModelApiRequest,
  ModelApiResponse,
  ClassifiedTweet,
  TrendingKeyword,
  BatchMeta,
} from './interfaces';
import { firstValueFrom } from 'rxjs';
import { RedisService } from 'src/redis/redis.service';
import { TrendingService } from 'src/trending/trending.service';

@Injectable()
export class TweetAnalyzeService implements OnModuleInit {
  private readonly logger = new Logger(TweetAnalyzeService.name);
  private readonly analyzeEnabled: boolean;
  private readonly intervalMinutes: number;
  private readonly requestLimit: number;
  private readonly analyzeApiUrl: string;
  private readonly LOCK_KEY = 'tweet-analyze:lock';
  private readonly LOCK_TTL_SECONDS = 300; // 5 minutes

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly repository: TweetAnalyzeRepository,
    private readonly redisService: RedisService,
    private readonly trendingService: TrendingService,
  ) {
    this.analyzeEnabled = this.configService.get<string>('CLASSIFY_TWEETS') === 'true';
    this.intervalMinutes = parseInt(
      this.configService.get<string>('CLASSIFICATION_INTERVAL_MINUTES') || '5',
    );
    this.requestLimit = parseInt(this.configService.get<string>('CLASSIFY_REQ_LIMIT') || '50');
    this.analyzeApiUrl = this.configService.get<string>('CLASSIFICATION_API_URL', '/analyze');

    this.logger.log(
      `Tweet Analysis Service initialized - Enabled: ${this.analyzeEnabled}, ` +
        `Interval: ${this.intervalMinutes} min, Request Limit: ${this.requestLimit}/batch`,
    );
  }

  onModuleInit() {
    if (this.analyzeEnabled) {
      const intervalMs = this.intervalMinutes * 60 * 1000;
      this.logger.log(`Starting tweet analysis cron job (interval: ${this.intervalMinutes} min)`);

      setInterval(() => {
        this.analyzeTweets().catch((error) => {
          this.logger.error(
            'Scheduled tweet analysis failed',
            error instanceof Error ? error.stack : String(error),
          );
        });
      }, intervalMs);
    } else {
      this.logger.log('Tweet analysis cron job is disabled');
    }
  }

  async analyzeTweets() {
    if (!this.analyzeEnabled) {
      this.logger.debug('Tweet analysis is disabled, skipping');
      return;
    }

    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      this.logger.debug('Analysis job already running in another instance, skipping');
      return;
    }

    this.logger.log('=== Starting Tweet Analysis Job ===');

    try {
      const tweetsToAnalyze = await this.getTweetsToAnalyze();

      if (tweetsToAnalyze.length === 0) {
        this.logger.log('No tweets to analyze');
        return;
      }

      this.logger.log(`Retrieved ${tweetsToAnalyze.length} tweets for analysis`);

      const batches = this.splitIntoBatches(tweetsToAnalyze, this.requestLimit);

      this.logger.log(
        `Split into ${batches.length} batch(es) (limit: ${this.requestLimit} tweets/batch)`,
      );

      let totalAnalyzedTweets = 0;
      let allBatchesSucceeded = true;

      // Accumulate trending data across all batches
      const accumulatedTrendingKeywords: TrendingKeyword[] = [];
      let totalTweetsInAllBatches = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        this.logger.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} tweets)`);

        try {
          const batchResult = await this.processBatch(batch);
          totalAnalyzedTweets += batchResult.analyzedTweetsCount;

          // Accumulate trending keywords from this batch
          if (batchResult.trending_keywords) {
            accumulatedTrendingKeywords.push(...batchResult.trending_keywords);
          }
          if (batchResult.batch_meta) {
            totalTweetsInAllBatches += batchResult.batch_meta.total_tweets;
          }

          this.logger.log(
            `Batch ${i + 1}/${batches.length} completed ` +
              `(analyzed: ${batchResult.analyzedTweetsCount}, keywords: ${batchResult.trending_keywords?.length || 0})`,
          );
        } catch (error) {
          this.logger.error(
            `Batch ${i + 1}/${batches.length} failed`,
            error instanceof Error ? error.stack : String(error),
          );
          this.logger.warn(
            `Stopping after batch ${i + 1} failure. ` +
              `${batches.length - i - 1} batch(es) will retry in next run`,
          );
          allBatchesSucceeded = false;
          break;
        }
      }

      // Update trending scores once with accumulated data from all batches
      if (accumulatedTrendingKeywords.length > 0) {
        this.logger.log(
          `Updating trending scores with ${accumulatedTrendingKeywords.length} accumulated keywords`,
        );
        await this.trendingService.updateTrendScores({
          batch_meta: { total_tweets: totalTweetsInAllBatches },
          trending_keywords: accumulatedTrendingKeywords,
        });
        this.logger.log('Trending scores updated successfully');
      }

      if (allBatchesSucceeded) {
        this.logger.log(
          `=== Tweet Analysis Job Completed Successfully (${totalAnalyzedTweets} tweets) ===`,
        );
      } else {
        this.logger.warn(
          `=== Tweet Analysis Job Stopped (${totalAnalyzedTweets} tweets processed) ===`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Tweet analysis job failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
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
      const acquired = result === 'OK';
      if (acquired) {
        this.logger.debug(`Acquired distributed lock (TTL: ${this.LOCK_TTL_SECONDS}s)`);
      }
      return acquired;
    } catch (error) {
      this.logger.error(
        'Failed to acquire distributed lock',
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  private async releaseLock(): Promise<void> {
    try {
      await this.redisService.del(this.LOCK_KEY);
      this.logger.debug('Released distributed lock');
    } catch (error) {
      this.logger.error(
        'Failed to release distributed lock',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async getTweetsToAnalyze(): Promise<Array<{ id: bigint; content: string }>> {
    this.logger.debug('Fetching tweets to analyze from repository');
    const tweets = await this.repository.findTweetsToClassify();

    const validTweets = tweets.filter((tweet) => tweet.content !== null) as Array<{
      id: bigint;
      content: string;
    }>;

    this.logger.debug(`Found ${validTweets.length} valid tweets with content`);
    return validTweets;
  }

  private splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private async processBatch(tweets: Array<{ id: bigint; content: string }>): Promise<{
    analyzedTweetsCount: number;
    batch_meta: BatchMeta | null;
    trending_keywords: TrendingKeyword[] | null;
  }> {
    const requestPayload: ModelApiRequest = {
      tweets: tweets.map((tweet) => ({
        id: tweet.id.toString(),
        content: tweet.content,
      })),
    };

    this.logger.debug(`Sending ${tweets.length} tweets to analysis API`);

    const response = await firstValueFrom(
      this.httpService.post<ModelApiResponse>(this.analyzeApiUrl, requestPayload),
    );

    const { batch_meta, trending_keywords, tweets_detail } = response.data;

    if (!tweets_detail || tweets_detail.length === 0) {
      this.logger.warn('Analysis API returned no tweet results');
      return {
        analyzedTweetsCount: 0,
        batch_meta: null,
        trending_keywords: null,
      };
    }

    this.logger.debug(
      `Received response: ${tweets_detail.length} tweets, ${trending_keywords?.length || 0} keywords`,
    );

    await this.updateTweetAnalysis(tweets_detail);

    return {
      analyzedTweetsCount: tweets_detail.length,
      batch_meta: batch_meta || null,
      trending_keywords: trending_keywords || null,
    };
  }

  private async updateTweetAnalysis(analyzedTweets: Array<ClassifiedTweet>): Promise<void> {
    this.logger.debug(`Updating ${analyzedTweets.length} tweets in database`);

    let successCount = 0;
    let failCount = 0;

    for (const analyzed of analyzedTweets) {
      try {
        const tweetId = BigInt(analyzed.id);
        await this.repository.updateTweetClass(tweetId, analyzed.class);
        successCount++;

        this.logger.debug(`Updated tweet ${analyzed.id} → class: ${analyzed.class}`);
      } catch (error) {
        failCount++;
        this.logger.error(
          `Failed to update tweet ${analyzed.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    if (failCount > 0) {
      this.logger.warn(
        `Tweet update completed with errors (success: ${successCount}, failed: ${failCount})`,
      );
    } else {
      this.logger.debug(`All ${successCount} tweets updated successfully`);
    }
  }
}
