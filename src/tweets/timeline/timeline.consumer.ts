import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RedisService } from 'src/redis/redis.service';
import { UsersService } from 'src/users/users.service';
import { TweetFanoutJob } from './interfaces/TweetFanoutJob.interface';
import { TIMELINE_MAX_SIZE } from '../timeline/constants/timeline.constants';

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
      case 'fanout':
        await this.fanoutTweetToTimelines(job as Job<TweetFanoutJob>);
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name} with id ${job.id}`);
        await job.remove();
        this.logger.log(`Removed invalid job ${job.id} from the queue`);
    }
  }

  async fanoutTweetToTimelines(job: Job<TweetFanoutJob>): Promise<void> {
    try {
      const { tweetId, authorId, timestamp } = job.data;
      this.logger.log(
        `Processing timeline-following fanout job ${job.id} for tweet ${tweetId} by author ${authorId}`,
      );
      const followerIds: string[] = (await this.usersService.getFollowersIds(BigInt(authorId))).map(
        (id) => id.toString(),
      );
      followerIds.unshift(authorId.toString());

      // Fanout should be to existing keys only (active users), those keys are created when the timeline cache misses, and persist for a configured time
      const timelineKeys = followerIds.map((id) => `timeline:${id}`);
      const existingKeyspipeline = this.redisClient.pipeline();
      for (const key of timelineKeys) {
        existingKeyspipeline.exists(`timeline:${key}`);
      }
      const existingKeysResults = await existingKeyspipeline.exec();

      if (!existingKeysResults) {
        return; // though this never happens, at least the author timeline key exists
      }
      // const existingKeys = timelineKeys.filter((_, index) => existingKeysResults[index][1] === 1);
      const compositeId = `${authorId}:${tweetId}`;

      const writePipeline = this.redisClient.pipeline();
      for (const key of timelineKeys) {
        writePipeline.zadd(key, timestamp, compositeId);
        writePipeline.zremrangebyrank(key, 0, -(TIMELINE_MAX_SIZE + 1)); // keep timeline size capped at TIMELINE_MAX_SIZE
      }

      await writePipeline.exec();
    } catch (error) {
      this.logger.error(`Error processing timeline-following fanout job ${job.id}`, error);
      throw error; // for retry
    }
  }
}
