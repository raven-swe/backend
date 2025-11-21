import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RedisService } from 'src/redis/redis.service';
import { UsersService } from 'src/users/users.service';
import { TweetFanoutJob } from './interfaces/TweetFanoutJob.interface';

@Processor('timeline-following')
export class TimelineConsumer extends WorkerHost {
  private readonly redisClient;

  constructor(
    private readonly redisService: RedisService,
    private readonly usersService: UsersService,
  ) {
    super();
    this.redisClient = this.redisService.getClient();
  }

  async process(job: Job<TweetFanoutJob>): Promise<void> {
    const { tweetId, authorId, timestamp } = job.data;

    const followerIds = await this.usersService.getFollowersForTweetFanout(BigInt(authorId));
    if (followerIds.length === 0) {
      return; // TODO add only to author timeline
    }

    // Fanout should be to existing keys only (active users), those keys are created when the timeline cache misses and persists for a configured time
    const timelineKeys = followerIds.map((id) => `timeline:${id}`);
    const existingKeyspipeline = this.redisClient.pipeline();
    for (const key of timelineKeys) {
      existingKeyspipeline.exists(`timeline:${key}`);
    }
    const existingKeysResults = await existingKeyspipeline.exec();

    const existingKeys = timelineKeys.filter((_, index) => existingKeysResults![index][1] === 1);

    const compositeId = `${authorId}:${tweetId}`;
    const writePipeline = this.redisClient.pipeline();
    for (const key of existingKeys) {
      writePipeline.zadd(key, timestamp, compositeId);
    }

    await writePipeline.exec();
  }
}
