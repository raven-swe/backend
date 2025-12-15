import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { REDIS_TIMELINE_KEYS } from 'src/common/constants/redis-timeline-keys.constant';
import { RedisService } from 'src/redis/redis.service';
import { SseEventsService } from 'src/sse/sse-events.service';
import { UsersRepository } from 'src/users/users.repository';
import { NEW_TWEETS_INDICATOR_MAX_AUTHORS } from './constants';

@Injectable()
export class TimelineEventsService {
  private readonly logger = new Logger(TimelineEventsService.name);
  private readonly redisClient;

  constructor(
    private readonly redisService: RedisService,
    private readonly usersRepository: UsersRepository,
    private readonly sseEventsService: SseEventsService,
  ) {
    this.redisClient = redisService.getClient();
  }

  @Cron('0 */2 * * * *')
  async handleNewTweetsCheck() {
    this.logger.debug('Checking for online users with following timeline SSE connections');

    const onlineUserIds = await this.redisClient.smembers(
      REDIS_TIMELINE_KEYS.getSSEOnlineFollowingTimelineKey(),
    );

    if (onlineUserIds.length === 0) {
      this.logger.debug('No users online for timeline events. Skipping check.');
      return;
    }

    this.logger.debug(`Checking new tweet indicators for ${onlineUserIds.length} online users.`);

    for (const userId of onlineUserIds) {
      try {
        const indicatorKey = REDIS_TIMELINE_KEYS.getNewTweetsIndicatorKey(BigInt(userId));

        // transaction prevents the race condition of getting a new tweet event while the cron job is running
        const transaction = this.redisClient.multi();
        transaction.zrevrange(indicatorKey, 0, NEW_TWEETS_INDICATOR_MAX_AUTHORS - 1);
        transaction.del(indicatorKey);
        const execResult = await transaction.exec();
        let newActorIds: string[] = [];
        // transaction result is [[err, Set<string>], [err, number of deleted keys]]
        if (execResult && Array.isArray(execResult) && execResult[0] && !execResult[0][0]) {
          newActorIds = Array.isArray(execResult[0][1])
            ? (execResult[0][1] as string[]).slice(0, 3)
            : [];
        }

        if (newActorIds.length > 0) {
          const authors = await this.usersRepository.findAvatarUrlsByUserIds(
            newActorIds.map((id) => BigInt(id)),
          );

          const authorAvatarsOrdered = newActorIds.map((id) => authors.get(id)!);

          await this.sseEventsService.publishTimelineFollowingTweets(
            BigInt(userId),
            authorAvatarsOrdered,
          );

          await this.redisClient.del(indicatorKey);
        }
      } catch (error) {
        this.logger.error(`Failed to process new tweets indicator for user ${userId}`, error);
      }
    }
  }
}
