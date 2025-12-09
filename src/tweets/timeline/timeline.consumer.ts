import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RedisService } from 'src/redis/redis.service';
import { UsersService } from 'src/users/users.service';
import { RetweetFanoutJob, TweetFanoutJob } from './interfaces/tweet-fanout-job.interface';
import { TIMELINE_MAX_SIZE } from '../timeline/constants/timeline.constants';
import { REDIS_TIMELINE_KEYS } from 'src/common/constants/redis-timeline-keys.constant';
import { TweetsRepository } from '../tweets.repository';
import { BackfillFollowJob } from './interfaces/backfill-follow-job.interface';

function isRetweetFanoutJob(
  actionType: 'T' | 'R',
  job: TweetFanoutJob | RetweetFanoutJob,
): job is RetweetFanoutJob {
  return actionType === 'R' && (job as RetweetFanoutJob).retweeterId !== undefined;
}

@Processor('timeline-following')
export class TimelineConsumer extends WorkerHost {
  private readonly redisClient;
  private readonly logger = new Logger(TimelineConsumer.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly usersService: UsersService,
    private readonly tweetsRepository: TweetsRepository,
  ) {
    super();
    this.redisClient = this.redisService.getClient();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'fanout-tweet':
        await this.fanoutTweetToTimelines(job as Job<TweetFanoutJob>, 'T');
        break;
      case 'fanout-retweet':
        await this.fanoutTweetToTimelines(job as Job<RetweetFanoutJob>, 'R');
        break;
      case 'purge-retweet':
        await this.purgeRetweetFromTimelines(job as Job<RetweetFanoutJob>);
        break;
      case 'backfill-follow':
        await this.backfillFollowToTimeline(job as Job<BackfillFollowJob>);
        break;

      default:
        this.logger.warn(`Unknown job name: ${job.name} with id ${job.id}`);
        await job.remove();
        this.logger.log(`Removed invalid job ${job.id} from the queue`);
    }
  }

  async fanoutTweetToTimelines(job: Job<TweetFanoutJob>, actionType: 'T' | 'R'): Promise<void> {
    try {
      const { tweetId, authorId, timestamp } = job.data;
      this.logger.debug(
        `Processing timeline-following fanout job ${job.id} for tweet ${tweetId} by author ${authorId}, ${actionType === 'R' ? `retweeter ${(<RetweetFanoutJob>job.data).retweeterId}` : ''}`,
      );

      const followerIds: string[] = (await this.usersService.getFollowersIds(BigInt(authorId))).map(
        (id) => id.toString(),
      );
      followerIds.unshift(authorId.toString());

      // Fanout should be to existing keys only (active users), those keys are created when the timeline cache misses, and persist for a configured time
      const timelineKeys = followerIds.map((id) =>
        REDIS_TIMELINE_KEYS.getUserTimelineKey(BigInt(id)),
      );
      const existingKeyspipeline = this.redisClient.pipeline();
      for (const key of timelineKeys) {
        existingKeyspipeline.exists(key);
      }
      const existingKeysResults = await existingKeyspipeline.exec();

      if (!existingKeysResults) {
        return; // though this never happens, at least the author timeline key exists
      }
      const existingKeys = timelineKeys.filter((_, index) => existingKeysResults[index][1] === 1);
      const compositeId = isRetweetFanoutJob(actionType, job.data)
        ? REDIS_TIMELINE_KEYS.getTimelineRetweetItem(
            BigInt(authorId),
            BigInt(tweetId),
            BigInt(job.data.retweeterId),
          )
        : REDIS_TIMELINE_KEYS.getTimelineTweetItem(BigInt(authorId), BigInt(tweetId));

      const writePipeline = this.redisClient.pipeline();
      for (const key of existingKeys) {
        writePipeline.del(
          REDIS_TIMELINE_KEYS.getUserTimelineEmptyPlaceholderKey(BigInt(key.split(':')[1])),
        ); // remove empty placeholder if exists
        writePipeline.zadd(key, timestamp, compositeId);
        writePipeline.zremrangebyrank(key, 0, -(TIMELINE_MAX_SIZE + 1)); // keep timeline size capped at TIMELINE_MAX_SIZE
      }

      await writePipeline.exec();
    } catch (error) {
      this.logger.error(`Error processing timeline-following fanout job ${job.id}`, error);
      throw error; // for retry
    }
  }

  async purgeRetweetFromTimelines(job: Job<RetweetFanoutJob>): Promise<void> {
    try {
      const { tweetId, authorId, retweeterId } = job.data;
      this.logger.debug(
        `Processing timeline-following purge retweet job ${job.id} for tweet ${tweetId} by author ${authorId} retweeter ${retweeterId}`,
      );

      const followerIds: string[] = (
        await this.usersService.getFollowersIds(BigInt(retweeterId))
      ).map((id) => id.toString());
      followerIds.unshift(retweeterId.toString());

      const timelineKeys = followerIds.map((id) =>
        REDIS_TIMELINE_KEYS.getUserTimelineKey(BigInt(id)),
      );
      const compositeId = REDIS_TIMELINE_KEYS.getTimelineRetweetItem(
        BigInt(authorId),
        BigInt(tweetId),
        BigInt(retweeterId),
      );

      const deletePipeline = this.redisClient.pipeline();
      for (const key of timelineKeys) {
        deletePipeline.zrem(key, compositeId);
      }

      await deletePipeline.exec();
    } catch (error) {
      this.logger.error(`Error processing timeline-following purge retweet job ${job.id}`, error);
      throw error; // for retry
    }
  }

  async backfillFollowToTimeline(job: Job<BackfillFollowJob>): Promise<void> {
    try {
      this.logger.debug(`Processing timeline-following backfill job ${job.id}`);
      const { followerId, followedId, followedAt } = job.data;

      const timelineKey = REDIS_TIMELINE_KEYS.getUserTimelineKey(BigInt(followerId));

      const tweetsToBackfill = await this.tweetsRepository.getRecentTweetsFromUser(
        BigInt(followedId),
        new Date(followedAt),
        TIMELINE_MAX_SIZE, // up to full timeline size
      );

      if (tweetsToBackfill.length === 0) {
        this.logger.debug(`No tweets from followed user ${followedId} to backfill`);
        return;
      }

      this.logger.debug(`Backfilling ${tweetsToBackfill.length} tweets for follower ${followerId}`);

      const pipeline = this.redisClient.pipeline();

      for (const tweet of tweetsToBackfill) {
        const compositeId =
          tweet.type === 'R'
            ? REDIS_TIMELINE_KEYS.getTimelineRetweetItem(
                BigInt(tweet.authorId),
                BigInt(tweet.id),
                BigInt(tweet.retweeterId!),
              )
            : REDIS_TIMELINE_KEYS.getTimelineTweetItem(BigInt(tweet.authorId), BigInt(tweet.id));

        pipeline.zadd(timelineKey, tweet.createdAt.getTime(), compositeId);
      }

      // handles the most recent by default
      pipeline.zremrangebyrank(timelineKey, 0, -(TIMELINE_MAX_SIZE + 1));

      // delete empty placeholder if exists
      pipeline.del(REDIS_TIMELINE_KEYS.getUserTimelineEmptyPlaceholderKey(BigInt(followerId)));

      await pipeline.exec();

      this.logger.debug(
        `Successfully backfilled ${tweetsToBackfill.length} tweets for follower ${followerId}`,
      );
    } catch (error) {
      this.logger.error(`Error processing follow backfill job ${job.id}`, error);
      throw error;
    }
  }
}
