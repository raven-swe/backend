import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { TimelineConsumer } from 'src/tweets/timeline/timeline.consumer';
import { RedisService } from 'src/redis/redis.service';
import { UsersService } from 'src/users/users.service';
import { TweetsRepository } from 'src/tweets/tweets.repository';
import {
  TweetFanoutJob,
  RetweetFanoutJob,
} from 'src/tweets/timeline/interfaces/tweet-fanout-job.interface';
import { BackfillFollowJob } from 'src/tweets/timeline/interfaces/backfill-follow-job.interface';

describe('TimelineConsumer', () => {
  let consumer: TimelineConsumer;

  const mockPipeline = {
    del: jest.fn().mockReturnThis(),
    exists: jest.fn().mockReturnThis(),
    zadd: jest.fn().mockReturnThis(),
    zremrangebyrank: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    zrem: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };

  const mockRedisClient = {
    pipeline: jest.fn().mockReturnValue(mockPipeline),
  };

  const mockRedisService = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
  };

  const mockUsersService = {
    getFollowersIds: jest.fn(),
  };

  const mockTweetsRepository = {
    getRecentTweetsFromUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimelineConsumer,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: TweetsRepository,
          useValue: mockTweetsRepository,
        },
      ],
    }).compile();

    consumer = module.get<TimelineConsumer>(TimelineConsumer);

    jest.clearAllMocks();
    mockPipeline.exec.mockResolvedValue([]);
  });

  it('should be defined', () => {
    expect(consumer).toBeDefined();
  });

  describe('process', () => {
    it('should process fanout-tweet job', async () => {
      const jobData: TweetFanoutJob = {
        tweetId: '123',
        authorId: '456',
        timestamp: Date.now(),
      };

      const mockJob = {
        id: 'job-1',
        name: 'fanout-tweet',
        data: jobData,
      } as Job<TweetFanoutJob>;

      mockUsersService.getFollowersIds.mockResolvedValue([BigInt(789), BigInt(101)]);
      mockPipeline.exec.mockResolvedValue([
        [null, 1],
        [null, 1],
        [null, 1],
      ]);

      await consumer.process(mockJob);

      expect(mockUsersService.getFollowersIds).toHaveBeenCalledWith(BigInt(456));
    });

    it('should process fanout-retweet job', async () => {
      const jobData: RetweetFanoutJob = {
        tweetId: '123',
        authorId: '456',
        timestamp: Date.now(),
        retweeterId: '789',
      };

      const mockJob = {
        id: 'job-2',
        name: 'fanout-retweet',
        data: jobData,
      } as Job<RetweetFanoutJob>;

      mockUsersService.getFollowersIds.mockResolvedValue([BigInt(101)]);
      mockPipeline.exec.mockResolvedValue([
        [null, 1],
        [null, 1],
      ]);

      await consumer.process(mockJob);

      expect(mockUsersService.getFollowersIds).toHaveBeenCalledWith(BigInt(456));
    });

    it('should process purge-retweet job', async () => {
      const jobData: RetweetFanoutJob = {
        tweetId: '123',
        authorId: '456',
        timestamp: Date.now(),
        retweeterId: '789',
      };

      const mockJob = {
        id: 'job-3',
        name: 'purge-retweet',
        data: jobData,
      } as Job<RetweetFanoutJob>;

      mockUsersService.getFollowersIds.mockResolvedValue([BigInt(101)]);

      await consumer.process(mockJob);

      expect(mockUsersService.getFollowersIds).toHaveBeenCalledWith(BigInt(789));
      expect(mockPipeline.zrem).toHaveBeenCalled();
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should process backfill-follow job', async () => {
      const jobData: BackfillFollowJob = {
        followerId: '123',
        followedId: '456',
        followedAt: new Date(),
      };

      const mockJob = {
        id: 'job-4',
        name: 'backfill-follow',
        data: jobData,
      } as Job<BackfillFollowJob>;

      mockTweetsRepository.getRecentTweetsFromUser.mockResolvedValue([
        {
          id: BigInt(1001),
          authorId: BigInt(456),
          type: 'T',
          createdAt: new Date(),
        },
      ]);

      await consumer.process(mockJob);

      expect(mockTweetsRepository.getRecentTweetsFromUser).toHaveBeenCalledWith(
        BigInt(456),
        expect.any(Date),
        expect.any(Number),
      );
      expect(mockPipeline.zadd).toHaveBeenCalled();
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should handle backfill-follow job with no tweets to backfill', async () => {
      const jobData: BackfillFollowJob = {
        followerId: '123',
        followedId: '456',
        followedAt: new Date(),
      };

      const mockJob = {
        id: 'job-5',
        name: 'backfill-follow',
        data: jobData,
      } as Job<BackfillFollowJob>;

      mockTweetsRepository.getRecentTweetsFromUser.mockResolvedValue([]);

      await consumer.process(mockJob);

      expect(mockTweetsRepository.getRecentTweetsFromUser).toHaveBeenCalled();
      expect(mockPipeline.zadd).not.toHaveBeenCalled();
    });

    it('should remove unknown job type', async () => {
      const removeMock = jest.fn().mockResolvedValue(undefined);
      const mockJob = {
        id: 'job-unknown',
        name: 'unknown-job-type',
        data: {},
        remove: removeMock,
      } as unknown as Job;

      await consumer.process(mockJob);

      expect(removeMock).toHaveBeenCalled();
    });
  });

  describe('fanoutTweetToTimelines', () => {
    it('should fanout tweet to all active follower timelines', async () => {
      const jobData: TweetFanoutJob = {
        tweetId: '123',
        authorId: '456',
        timestamp: Date.now(),
      };

      const mockJob = {
        id: 'job-fanout-1',
        name: 'fanout-tweet',
        data: jobData,
      } as Job<TweetFanoutJob>;

      mockUsersService.getFollowersIds.mockResolvedValue([BigInt(789), BigInt(101), BigInt(102)]);
      mockPipeline.exec
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          [null, 1],
          [null, 1],
          [null, 1],
          [null, 0],
        ])
        .mockResolvedValueOnce([]);

      await consumer.fanoutTweetToTimelines(mockJob, 'T');

      expect(mockUsersService.getFollowersIds).toHaveBeenCalledWith(BigInt(456));
      expect(mockPipeline.del).toHaveBeenCalled();
      expect(mockPipeline.exists).toHaveBeenCalled();
      expect(mockPipeline.zadd).toHaveBeenCalled();
    });

    it('should fanout retweet with correct composite id', async () => {
      const jobData: RetweetFanoutJob = {
        tweetId: '123',
        authorId: '456',
        timestamp: Date.now(),
        retweeterId: '789',
      };

      const mockJob = {
        id: 'job-fanout-retweet',
        name: 'fanout-retweet',
        data: jobData,
      } as Job<RetweetFanoutJob>;

      mockUsersService.getFollowersIds.mockResolvedValue([BigInt(101)]);
      mockPipeline.exec
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          [null, 1],
          [null, 1],
        ])
        .mockResolvedValueOnce([]);

      await consumer.fanoutTweetToTimelines(mockJob, 'R');

      expect(mockUsersService.getFollowersIds).toHaveBeenCalledWith(BigInt(456));
      expect(mockPipeline.zadd).toHaveBeenCalled();
    });

    it('should not write to timelines when no active users exist', async () => {
      const jobData: TweetFanoutJob = {
        tweetId: '123',
        authorId: '456',
        timestamp: Date.now(),
      };

      const mockJob = {
        id: 'job-no-active',
        name: 'fanout-tweet',
        data: jobData,
      } as Job<TweetFanoutJob>;

      mockUsersService.getFollowersIds.mockResolvedValue([BigInt(789)]);
      mockPipeline.exec
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          [null, 0],
          [null, 0],
        ])
        .mockResolvedValueOnce([]);

      await consumer.fanoutTweetToTimelines(mockJob, 'T');

      expect(mockUsersService.getFollowersIds).toHaveBeenCalled();
    });

    it('should handle error during fanout and rethrow', async () => {
      const jobData: TweetFanoutJob = {
        tweetId: '123',
        authorId: '456',
        timestamp: Date.now(),
      };

      const mockJob = {
        id: 'job-error',
        name: 'fanout-tweet',
        data: jobData,
      } as Job<TweetFanoutJob>;

      const error = new Error('Redis connection failed');
      mockUsersService.getFollowersIds.mockRejectedValue(error);

      await expect(consumer.fanoutTweetToTimelines(mockJob, 'T')).rejects.toThrow(
        'Redis connection failed',
      );
    });

    it('should return early when existingKeysResults is null', async () => {
      const jobData: TweetFanoutJob = {
        tweetId: '123',
        authorId: '456',
        timestamp: Date.now(),
      };

      const mockJob = {
        id: 'job-null-results',
        name: 'fanout-tweet',
        data: jobData,
      } as Job<TweetFanoutJob>;

      mockUsersService.getFollowersIds.mockResolvedValue([BigInt(789)]);
      mockPipeline.exec.mockResolvedValueOnce([]).mockResolvedValueOnce(null);

      await consumer.fanoutTweetToTimelines(mockJob, 'T');

      expect(mockPipeline.exec).toHaveBeenCalledTimes(2);
    });
  });

  describe('purgeRetweetFromTimelines', () => {
    it('should remove retweet from all follower timelines', async () => {
      const jobData: RetweetFanoutJob = {
        tweetId: '123',
        authorId: '456',
        timestamp: Date.now(),
        retweeterId: '789',
      };

      const mockJob = {
        id: 'job-purge-1',
        name: 'purge-retweet',
        data: jobData,
      } as Job<RetweetFanoutJob>;

      mockUsersService.getFollowersIds.mockResolvedValue([BigInt(101), BigInt(102)]);

      await consumer.purgeRetweetFromTimelines(mockJob);

      expect(mockUsersService.getFollowersIds).toHaveBeenCalledWith(BigInt(789));
      expect(mockPipeline.zrem).toHaveBeenCalled();
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should handle error during purge and rethrow', async () => {
      const jobData: RetweetFanoutJob = {
        tweetId: '123',
        authorId: '456',
        timestamp: Date.now(),
        retweeterId: '789',
      };

      const mockJob = {
        id: 'job-purge-error',
        name: 'purge-retweet',
        data: jobData,
      } as Job<RetweetFanoutJob>;

      const error = new Error('Purge failed');
      mockUsersService.getFollowersIds.mockRejectedValue(error);

      await expect(consumer.purgeRetweetFromTimelines(mockJob)).rejects.toThrow('Purge failed');
    });
  });

  describe('backfillFollowToTimeline', () => {
    it('should backfill tweets from followed user to follower timeline', async () => {
      const jobData: BackfillFollowJob = {
        followerId: '123',
        followedId: '456',
        followedAt: new Date('2024-01-01'),
      };

      const mockJob = {
        id: 'job-backfill-1',
        name: 'backfill-follow',
        data: jobData,
      } as Job<BackfillFollowJob>;

      mockTweetsRepository.getRecentTweetsFromUser.mockResolvedValue([
        {
          id: BigInt(1001),
          authorId: BigInt(456),
          type: 'T',
          createdAt: new Date('2024-01-02'),
        },
        {
          id: BigInt(1002),
          authorId: BigInt(456),
          type: 'T',
          createdAt: new Date('2024-01-03'),
        },
      ]);

      await consumer.backfillFollowToTimeline(mockJob);

      expect(mockTweetsRepository.getRecentTweetsFromUser).toHaveBeenCalledWith(
        BigInt(456),
        new Date('2024-01-01'),
        expect.any(Number),
      );
      expect(mockPipeline.zadd).toHaveBeenCalledTimes(2);
      expect(mockPipeline.zremrangebyrank).toHaveBeenCalled();
      expect(mockPipeline.del).toHaveBeenCalled();
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should handle retweets correctly during backfill', async () => {
      const jobData: BackfillFollowJob = {
        followerId: '123',
        followedId: '456',
        followedAt: new Date('2024-01-01'),
      };

      const mockJob = {
        id: 'job-backfill-retweet',
        name: 'backfill-follow',
        data: jobData,
      } as Job<BackfillFollowJob>;

      mockTweetsRepository.getRecentTweetsFromUser.mockResolvedValue([
        {
          id: BigInt(1001),
          authorId: BigInt(789),
          type: 'R',
          retweeterId: BigInt(456),
          createdAt: new Date('2024-01-02'),
        },
      ]);

      await consumer.backfillFollowToTimeline(mockJob);

      expect(mockPipeline.zadd).toHaveBeenCalled();
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should not execute pipeline when no tweets to backfill', async () => {
      const jobData: BackfillFollowJob = {
        followerId: '123',
        followedId: '456',
        followedAt: new Date('2024-01-01'),
      };

      const mockJob = {
        id: 'job-backfill-empty',
        name: 'backfill-follow',
        data: jobData,
      } as Job<BackfillFollowJob>;

      mockTweetsRepository.getRecentTweetsFromUser.mockResolvedValue([]);

      await consumer.backfillFollowToTimeline(mockJob);

      expect(mockTweetsRepository.getRecentTweetsFromUser).toHaveBeenCalled();
      expect(mockPipeline.zadd).not.toHaveBeenCalled();
      expect(mockPipeline.exec).not.toHaveBeenCalled();
    });

    it('should handle error during backfill and rethrow', async () => {
      const jobData: BackfillFollowJob = {
        followerId: '123',
        followedId: '456',
        followedAt: new Date('2024-01-01'),
      };

      const mockJob = {
        id: 'job-backfill-error',
        name: 'backfill-follow',
        data: jobData,
      } as Job<BackfillFollowJob>;

      const error = new Error('Backfill failed');
      mockTweetsRepository.getRecentTweetsFromUser.mockRejectedValue(error);

      await expect(consumer.backfillFollowToTimeline(mockJob)).rejects.toThrow('Backfill failed');
    });
  });
});
