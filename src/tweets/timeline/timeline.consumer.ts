import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RedisService } from 'src/redis/redis.service';
import { UsersService } from 'src/users/users.service';
import { RetweetFanoutJob, TweetFanoutJob } from './interfaces/tweet-fanout-job.interface';
import {
  NEW_TWEETS_INDICATOR_MAX_AUTHORS,
  NEW_TWEETS_INDICATOR_TTL,
  TIMELINE_MAX_SIZE,
} from './constants/timeline.constants';
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

      const actorId = isRetweetFanoutJob(actionType, job.data)
        ? BigInt(job.data.retweeterId)
        : BigInt(authorId);

      const allRecipinetIds = [actorId.toString(), ...new Set(followerIds)];

      // delete EMPTY_PLACEHOLDER for ALL the recipients
      const deletePipeline = this.redisClient.pipeline();
      for (const userId of allRecipinetIds) {
        const emptyPlaceholderKey = REDIS_TIMELINE_KEYS.getUserTimelineEmptyPlaceholderKey(
          BigInt(userId),
        );
        deletePipeline.del(emptyPlaceholderKey);
      }
      await deletePipeline.exec();

      // Fanout should be to existing keys only (active users), those keys are created when the timeline cache misses, and persist for a configured time
      const timelineKeys = allRecipinetIds.map((id) =>
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

      const activeUserIds = allRecipinetIds.filter(
        (_, index) => existingKeysResults[index][1] === 1,
      );
      const compositeId = isRetweetFanoutJob(actionType, job.data)
        ? REDIS_TIMELINE_KEYS.getTimelineRetweetItem(
            BigInt(authorId),
            BigInt(tweetId),
            BigInt(job.data.retweeterId),
          )
        : REDIS_TIMELINE_KEYS.getTimelineTweetItem(BigInt(authorId), BigInt(tweetId));

      const writePipeline = this.redisClient.pipeline();

      for (const userId of activeUserIds) {
        const timelineKey = REDIS_TIMELINE_KEYS.getUserTimelineKey(BigInt(userId));
        const newTweetIndicatorKey = REDIS_TIMELINE_KEYS.getNewTweetsIndicatorKey(BigInt(userId));

        writePipeline.zadd(timelineKey, timestamp, compositeId);
        writePipeline.zremrangebyrank(timelineKey, 0, -(TIMELINE_MAX_SIZE + 1)); // keep timeline size capped at TIMELINE_MAX_SIZE

        writePipeline.zadd(newTweetIndicatorKey, timestamp, actorId.toString());
        writePipeline.zremrangebyrank(
          newTweetIndicatorKey,
          0,
          -(NEW_TWEETS_INDICATOR_MAX_AUTHORS + 1),
        ); // only latest 3 indicators
        writePipeline.expire(newTweetIndicatorKey, NEW_TWEETS_INDICATOR_TTL);
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
