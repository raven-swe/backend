import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RedisService } from 'src/redis/redis.service';
import { UsersService } from 'src/users/users.service';
import { RetweetFanoutJob, TweetFanoutJob } from './interfaces/TweetFanoutJob.interface';
import { TIMELINE_MAX_SIZE } from '../timeline/constants/timeline.constants';
import { REDIS_TIMELINE_KEYS } from 'src/common/constants/redis-timeline-keys.constant';

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

      const followerIds: string[] = (await this.usersService.getFollowersIds(BigInt(authorId))).map(
        (id) => id.toString(),
      );
      followerIds.unshift(authorId.toString());

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

  // TODO i need the backfill to happen for follows
}
