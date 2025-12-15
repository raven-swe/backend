import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { TimelineService } from 'src/tweets/timeline/timeline.service';
import { RedisService } from 'src/redis/redis.service';
import { TweetsRepository } from 'src/tweets/tweets.repository';
import { UsersRepository } from 'src/users/users.repository';
import { PAGINATION_ERROR_CODES, PAGINATION_ERROR_MESSAGES } from 'src/common/constants';
import { DEFAULT_PROFILE_PICTURE } from 'src/users/constants';

const encodeCompositeCursor = (cursorObject: object): string => {
  const jsonString = JSON.stringify(cursorObject);
  return Buffer.from(jsonString).toString('base64');
};

describe('TimelineService', () => {
  let service: TimelineService;

  const mockPipeline = {
    get: jest.fn().mockReturnThis(),
    getex: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    setex: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    exists: jest.fn().mockReturnThis(),
    zadd: jest.fn().mockReturnThis(),
    zrevrangebyscore: jest.fn().mockReturnThis(),
    zrevrange: jest.fn().mockReturnThis(),
    zremrangebyrank: jest.fn().mockReturnThis(),
    zscore: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    sadd: jest.fn().mockReturnThis(),
    smembers: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };

  const mockRedisClient = {
    pipeline: jest.fn().mockReturnValue(mockPipeline),
    exists: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    zrevrangebyscore: jest.fn(),
    zrevrange: jest.fn(),
    zscore: jest.fn(),
    expire: jest.fn(),
    sadd: jest.fn(),
    smembers: jest.fn(),
  };

  const mockRedisService = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
  };

  const mockTweetsRepository = {
    getTimelineForUser: jest.fn(),
    filterValidAuthors: jest.fn(),
    filterValidTweets: jest.fn(),
    filterNonMutedAuthors: jest.fn(),
    getTweetsByIds: jest.fn(),
    getCompactAuthorsByIds: jest.fn(),
    getTweetCounts: jest.fn(),
    getUserTweetInteractions: jest.fn(),
    getAuthorRelationships: jest.fn(),
    getTweetsMatchingInterests: jest.fn(),
  };

  const mockUsersRepository = {
    getFollowingIds: jest.fn(),
    getUserInterests: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimelineService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: TweetsRepository,
          useValue: mockTweetsRepository,
        },
        {
          provide: UsersRepository,
          useValue: mockUsersRepository,
        },
      ],
    }).compile();

    service = module.get<TimelineService>(TimelineService);

    jest.clearAllMocks();
    mockPipeline.exec.mockResolvedValue([]);
    mockTweetsRepository.getTweetsByIds.mockResolvedValue([]);
    mockTweetsRepository.getCompactAuthorsByIds.mockResolvedValue([]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTimeline', () => {
    const userId = BigInt(1);

    it('should return empty timeline when empty placeholder exists', async () => {
      mockRedisClient.exists.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

      const result = await service.getTimeline(userId, undefined, 10);

      expect(result.items).toEqual([]);
      expect(result.pagination).toBeDefined();
    });

    it('should throw BAD_REQUEST for invalid cursor', async () => {
      await expect(service.getTimeline(userId, 'invalid-cursor', 10)).rejects.toThrow(
        new HttpException(
          {
            message: PAGINATION_ERROR_MESSAGES.INVALID_CURSOR,
            code: PAGINATION_ERROR_CODES.INVALID_CURSOR,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should process valid cursor correctly', async () => {
      const cursor = encodeCompositeCursor({
        createdAt: new Date().toISOString(),
        id: '123',
        seenIds: ['100', '101'],
      });

      mockRedisClient.exists.mockResolvedValue(1);
      mockRedisClient.zrevrangebyscore.mockResolvedValue([]);

      const result = await service.getTimeline(userId, cursor, 10);

      expect(result.items).toEqual([]);
    });

    it('should call timelineCacheMiss when timeline key does not exist and no empty placeholder', async () => {
      mockRedisClient.exists.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      mockTweetsRepository.getTimelineForUser.mockResolvedValue([]);

      const result = await service.getTimeline(userId, undefined, 10);

      expect(mockTweetsRepository.getTimelineForUser).toHaveBeenCalled();
      expect(result.items).toEqual([]);
    });
  });

  describe('timelineCacheHit', () => {
    const userId = BigInt(1);

    it('should return empty array when timeline empty placeholder exists', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const result = await service.timelineCacheHit(userId, undefined, 10, new Set());

      expect(result).toEqual([]);
      expect(mockRedisClient.expire).toHaveBeenCalled();
    });

    it('should return empty array when no timeline items found', async () => {
      mockRedisClient.exists.mockResolvedValue(0);
      mockRedisClient.zrevrangebyscore.mockResolvedValue([]);

      const result = await service.timelineCacheHit(userId, undefined, 10, new Set());

      expect(result).toEqual([]);
    });

    it('should filter and hydrate timeline items', async () => {
      mockRedisClient.exists.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      mockRedisClient.zrevrangebyscore.mockResolvedValue(['456:123:T']);

      mockTweetsRepository.filterValidAuthors.mockResolvedValue([BigInt(456)]);
      mockTweetsRepository.filterValidTweets.mockResolvedValue([BigInt(123)]);

      mockPipeline.exec
        .mockResolvedValueOnce([
          [
            null,
            JSON.stringify({
              id: '123',
              authorId: '456',
              content: 'Hello',
              createdAt: new Date().toISOString(),
            }),
          ],
          [null, JSON.stringify({ id: '456', username: 'testuser', displayName: 'Test' })],
        ])
        .mockResolvedValueOnce([
          [null, '5'],
          [null, '2'],
          [null, '1'],
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockTweetsRepository.getTweetsByIds.mockResolvedValue([]);
      mockTweetsRepository.getCompactAuthorsByIds.mockResolvedValue([]);

      mockTweetsRepository.getUserTweetInteractions.mockResolvedValue(
        new Map([[BigInt(123), { isLiked: false, isRetweeted: false }]]),
      );

      mockTweetsRepository.getAuthorRelationships.mockResolvedValue(
        new Map([
          [
            '456',
            {
              id: '456',
              username: 'testuser',
              displayName: 'Test',
              isFollowing: false,
              isFollowedBy: false,
            },
          ],
        ]),
      );

      const result = await service.timelineCacheHit(userId, undefined, 10, new Set());

      expect(result).toBeDefined();
      expect(mockTweetsRepository.filterValidAuthors).toHaveBeenCalled();
      expect(mockTweetsRepository.filterValidTweets).toHaveBeenCalled();
    });

    it('should filter out seen tweets from cross-request set', async () => {
      const seenSet = new Set(['123']);

      mockRedisClient.exists.mockResolvedValue(0);
      mockRedisClient.zrevrangebyscore.mockResolvedValue(['456:123:T', '789:124:T']);

      mockTweetsRepository.filterValidAuthors.mockResolvedValue([BigInt(789)]);
      mockTweetsRepository.filterValidTweets.mockResolvedValue([BigInt(124)]);

      mockPipeline.exec
        .mockResolvedValueOnce([
          [
            null,
            JSON.stringify({
              id: '124',
              authorId: '789',
              content: 'Test',
              createdAt: new Date().toISOString(),
            }),
          ],
          [null, JSON.stringify({ id: '789', username: 'user2', displayName: 'User 2' })],
        ])
        .mockResolvedValueOnce([
          [null, '3'],
          [null, '1'],
          [null, '0'],
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockTweetsRepository.getTweetsByIds.mockResolvedValue([]);
      mockTweetsRepository.getCompactAuthorsByIds.mockResolvedValue([]);
      mockTweetsRepository.getUserTweetInteractions.mockResolvedValue(new Map());
      mockTweetsRepository.getAuthorRelationships.mockResolvedValue(
        new Map([['789', { id: '789', username: 'user2' }]]),
      );

      await service.timelineCacheHit(userId, undefined, 10, seenSet);

      expect(mockTweetsRepository.filterValidTweets).toHaveBeenCalled();
    });
  });

  describe('backFillStaticDataToCache', () => {
    it('should return empty arrays when no missing data', async () => {
      const result = await service.backFillStaticDataToCache([], new Set());

      expect(result).toEqual({ tweets: [], authors: [] });
    });

    it('should fetch and cache missing tweets and authors', async () => {
      const missingTweetIds = [BigInt(123)];
      const missingAuthorIds = new Set([BigInt(456)]);

      mockTweetsRepository.getTweetsByIds.mockResolvedValue([
        { id: '123', authorId: '456', content: 'Test' },
      ]);
      mockTweetsRepository.getCompactAuthorsByIds.mockResolvedValue([
        { id: '456', username: 'testuser' },
      ]);
      mockPipeline.exec.mockResolvedValue([]);

      const result = await service.backFillStaticDataToCache(missingTweetIds, missingAuthorIds);

      expect(result.tweets).toHaveLength(1);
      expect(result.authors).toHaveLength(1);
      expect(mockPipeline.set).toHaveBeenCalled();
      expect(mockPipeline.exec).toHaveBeenCalled();
    });
  });

  describe('getAndBackfillTweetDynamicData', () => {
    it('should hydrate dynamic data from cache', async () => {
      const tweets = new Map([
        [
          '123',
          {
            id: '123',
            authorId: '456',
            content: 'Test',
            createdAt: new Date(),
            entities: { mentions: [], hashtags: [] },
            media: [],
            replyToTweetId: null,
            quoteToTweetId: null,
            rootTweetId: null,
          },
        ],
      ]);
      const userId = BigInt(1);

      mockPipeline.exec.mockResolvedValue([
        [null, '10'],
        [null, '5'],
        [null, '2'],
      ]);

      mockTweetsRepository.getUserTweetInteractions.mockResolvedValue(
        new Map([[BigInt(123), { isLiked: true, isRetweeted: false }]]),
      );

      const result = await service.getAndBackfillTweetDynamicData(tweets, userId);

      expect(result.likeCounts.get(BigInt(123))).toBe(10);
      expect(result.retweetCounts.get(BigInt(123))).toBe(5);
      expect(result.replyCounts.get(BigInt(123))).toBe(2);
    });

    it('should backfill missing counts from DB', async () => {
      const tweets = new Map([
        [
          '123',
          {
            id: '123',
            authorId: '456',
            content: 'Test',
            createdAt: new Date(),
            entities: { mentions: [], hashtags: [] },
            media: [],
            replyToTweetId: null,
            quoteToTweetId: null,
            rootTweetId: null,
          },
        ],
      ]);
      const userId = BigInt(1);

      mockPipeline.exec.mockResolvedValue([
        [null, null],
        [null, null],
        [null, null],
      ]);

      mockTweetsRepository.getTweetCounts.mockResolvedValue(
        new Map([['123', { likeCounts: 15, retweetCounts: 8, replyCounts: 3 }]]),
      );

      mockTweetsRepository.getUserTweetInteractions.mockResolvedValue(new Map());

      const result = await service.getAndBackfillTweetDynamicData(tweets, userId);

      expect(mockTweetsRepository.getTweetCounts).toHaveBeenCalled();
      expect(result.likeCounts.get(BigInt(123))).toBe(15);
    });

    it('should handle null pipeline result gracefully', async () => {
      const tweets = new Map([
        [
          '123',
          {
            id: '123',
            authorId: '456',
            content: 'Test',
            createdAt: new Date(),
            entities: { mentions: [], hashtags: [] },
            media: [],
            replyToTweetId: null,
            quoteToTweetId: null,
            rootTweetId: null,
          },
        ],
      ]);
      const userId = BigInt(1);

      mockPipeline.exec.mockResolvedValue(null);

      const result = await service.getAndBackfillTweetDynamicData(tweets, userId);

      expect(result.likeCounts.size).toBe(0);
      expect(result.userTweetInteractions.size).toBe(0);
    });
  });

  describe('hydrateStaticQuoteData', () => {
    beforeEach(() => {
      mockTweetsRepository.getTweetsByIds.mockResolvedValue([]);
      mockTweetsRepository.getCompactAuthorsByIds.mockResolvedValue([]);
    });

    it('should return empty maps when no quote tweet ids provided', async () => {
      mockPipeline.exec.mockResolvedValue([]);

      const result = await service.hydrateStaticQuoteData([]);

      expect(result.tweets).toBeDefined();
      expect(result.authors).toBeDefined();
    });

    it('should hydrate quote tweets from cache', async () => {
      const tweetData = { id: '999', authorId: '888', content: 'Quote' };
      const authorData = { id: '888', username: 'quoteauthor' };

      mockPipeline.exec
        .mockResolvedValueOnce([[null, JSON.stringify(tweetData)]])
        .mockResolvedValueOnce([[null, JSON.stringify(authorData)]])
        .mockResolvedValueOnce([]);

      const result = await service.hydrateStaticQuoteData(['999']);

      expect(result.tweets.has('999')).toBe(true);
      expect(result.authors.has('888')).toBe(true);
    });

    it('should backfill missing quote tweets from DB', async () => {
      mockPipeline.exec
        .mockResolvedValueOnce([[null, null]])
        .mockResolvedValueOnce([[null, null]])
        .mockResolvedValueOnce([]);

      mockTweetsRepository.getTweetsByIds.mockResolvedValue([
        { id: '999', authorId: '888', content: 'Quote from DB' },
      ]);
      mockTweetsRepository.getCompactAuthorsByIds.mockResolvedValue([
        { id: '888', username: 'dbauthor' },
      ]);

      const result = await service.hydrateStaticQuoteData(['999']);

      expect(result).toBeDefined();
      expect(mockTweetsRepository.getTweetsByIds).toHaveBeenCalled();
    });

    it('should handle null pipeline result gracefully', async () => {
      mockPipeline.exec.mockResolvedValue(null);

      const result = await service.hydrateStaticQuoteData(['999']);

      expect(result.tweets.size).toBe(0);
      expect(result.authors.size).toBe(0);
    });
  });

  describe('assembleTimelineTweets', () => {
    it('should assemble tweet DTOs correctly', () => {
      const items = ['456:123:T'];
      const tweets = new Map([
        [
          '123',
          {
            id: '123',
            authorId: '456',
            content: 'Hello',
            createdAt: new Date(),
            entities: { mentions: [], hashtags: [] },
            media: [],
            replyToTweetId: null,
            quoteToTweetId: null,
            rootTweetId: null,
          },
        ],
      ]);
      const authors = new Map([
        [
          '456',
          {
            id: '456',
            username: 'testuser',
            displayName: 'Test User',
            avatarUrl: DEFAULT_PROFILE_PICTURE,
          },
        ],
      ]);
      const fullAuthors = new Map([
        [
          '456',
          {
            id: '456',
            username: 'testuser',
            displayName: 'Test User',
            avatarUrl: DEFAULT_PROFILE_PICTURE,
            relationship: {
              following: false,
              follower: false,
            },
          },
        ],
      ]);
      const dynamicData = {
        likeCounts: new Map([[BigInt(123), 10]]),
        retweetCounts: new Map([[BigInt(123), 5]]),
        replyCounts: new Map([[BigInt(123), 2]]),
        userTweetInteractions: new Map([[BigInt(123), { isLiked: true, isRetweeted: false }]]),
      };

      const result = service.assembleTimelineTweets(
        items,
        tweets,
        authors,
        fullAuthors,
        dynamicData,
      );

      expect(result).toHaveLength(1);
      expect(result[0].likeCount).toBe(10);
      expect(result[0].isLiked).toBe(true);
    });

    it('should handle retweets with repostedBy field', () => {
      const items = ['456:123:R:789'];
      const tweets = new Map([
        [
          '123',
          {
            id: '123',
            authorId: '456',
            content: 'Hello',
            createdAt: new Date(),
            entities: { mentions: [], hashtags: [] },
            media: [],
            replyToTweetId: null,
            quoteToTweetId: null,
            rootTweetId: null,
          },
        ],
      ]);
      const authors = new Map([
        [
          '456',
          {
            id: '456',
            username: 'author',
            displayName: 'Author',
            avatarUrl: DEFAULT_PROFILE_PICTURE,
          },
        ],
        [
          '789',
          {
            id: '789',
            username: 'retweeter',
            displayName: 'Retweeter',
            avatarUrl: DEFAULT_PROFILE_PICTURE,
          },
        ],
      ]);
      const fullAuthors = new Map([
        [
          '456',
          {
            id: '456',
            username: 'author',
            displayName: 'Author',
            avatarUrl: DEFAULT_PROFILE_PICTURE,
            relationship: {
              following: false,
              follower: false,
            },
          },
        ],
      ]);
      const dynamicData = {
        likeCounts: new Map(),
        retweetCounts: new Map(),
        replyCounts: new Map(),
        userTweetInteractions: new Map(),
      };

      const result = service.assembleTimelineTweets(
        items,
        tweets,
        authors,
        fullAuthors,
        dynamicData,
      );

      expect(result).toHaveLength(1);
      expect(result[0].repostedBy).toBeDefined();
      expect(result[0].repostedBy!.username).toBe('retweeter');
    });

    it('should skip items with missing tweet or author', () => {
      const items = ['456:123:T', '999:888:T'];
      const tweets = new Map([
        [
          '123',
          {
            id: '123',
            authorId: '456',
            content: 'Hello',
            createdAt: new Date(),
            entities: { mentions: [], hashtags: [] },
            media: [],
            replyToTweetId: null,
            quoteToTweetId: null,
            rootTweetId: null,
          },
        ],
      ]);
      const authors = new Map([
        [
          '456',
          {
            id: '456',
            username: 'testuser',
            displayName: 'Test',
            avatarUrl: DEFAULT_PROFILE_PICTURE,
          },
        ],
      ]);
      const fullAuthors = new Map([
        [
          '456',
          {
            id: '456',
            username: 'testuser',
            displayName: 'Test',
            avatarUrl: DEFAULT_PROFILE_PICTURE,
            relationship: { following: false, follower: false },
          },
        ],
      ]);
      const dynamicData = {
        likeCounts: new Map(),
        retweetCounts: new Map(),
        replyCounts: new Map(),
        userTweetInteractions: new Map(),
      };

      const result = service.assembleTimelineTweets(
        items,
        tweets,
        authors,
        fullAuthors,
        dynamicData,
      );

      expect(result).toHaveLength(1);
    });

    it('should handle quoted tweets', () => {
      const items = ['456:123:T'];
      const tweets = new Map([
        [
          '123',
          {
            id: '123',
            authorId: '456',
            content: 'Quote tweet',
            quoteToTweetId: '999',
            createdAt: new Date(),
            entities: { mentions: [], hashtags: [] },
            media: [],
            replyToTweetId: null,
            rootTweetId: null,
          },
        ],
        [
          '999',
          {
            id: '999',
            authorId: '888',
            content: 'Original',
            createdAt: new Date(),
            entities: { mentions: [], hashtags: [] },
            media: [],
            replyToTweetId: null,
            quoteToTweetId: null,
            rootTweetId: null,
          },
        ],
      ]);
      const authors = new Map([
        [
          '456',
          {
            id: '456',
            username: 'quoter',
            displayName: 'Quoter',
            avatarUrl: DEFAULT_PROFILE_PICTURE,
          },
        ],
        [
          '888',
          {
            id: '888',
            username: 'original',
            displayName: 'Original',
            avatarUrl: DEFAULT_PROFILE_PICTURE,
          },
        ],
      ]);
      const fullAuthors = new Map([
        [
          '456',
          {
            id: '456',
            username: 'quoter',
            displayName: 'Quoter',
            avatarUrl: DEFAULT_PROFILE_PICTURE,
            relationship: { following: false, follower: false },
          },
        ],
        [
          '888',
          {
            id: '888',
            username: 'original',
            displayName: 'Original',
            avatarUrl: DEFAULT_PROFILE_PICTURE,
            relationship: { following: false, follower: false },
          },
        ],
      ]);
      const dynamicData = {
        likeCounts: new Map(),
        retweetCounts: new Map(),
        replyCounts: new Map(),
        userTweetInteractions: new Map(),
      };

      const result = service.assembleTimelineTweets(
        items,
        tweets,
        authors,
        fullAuthors,
        dynamicData,
      );

      expect(result[0].quotedTweet).toBeDefined();
    });

    it('should mark quoted tweet as deleted when not found', () => {
      const items = ['456:123:T'];
      const tweets = new Map([
        [
          '123',
          {
            id: '123',
            authorId: '456',
            content: 'Quote tweet',
            quoteToTweetId: '999',
            createdAt: new Date(),
            entities: { mentions: [], hashtags: [] },
            media: [],
            replyToTweetId: null,
            rootTweetId: null,
          },
        ],
      ]);
      const authors = new Map([
        [
          '456',
          {
            id: '456',
            username: 'quoter',
            displayName: 'Quoter',
            avatarUrl: DEFAULT_PROFILE_PICTURE,
          },
        ],
      ]);
      const fullAuthors = new Map([
        [
          '456',
          {
            id: '456',
            username: 'quoter',
            displayName: 'Quoter',
            avatarUrl: DEFAULT_PROFILE_PICTURE,
            relationship: { following: false, follower: false },
          },
        ],
      ]);
      const dynamicData = {
        likeCounts: new Map(),
        retweetCounts: new Map(),
        replyCounts: new Map(),
        userTweetInteractions: new Map(),
      };

      const result = service.assembleTimelineTweets(
        items,
        tweets,
        authors,
        fullAuthors,
        dynamicData,
      );

      expect(result[0].quotedTweet).toEqual({ isDeleted: true });
    });
  });

  describe('getForYouFeed', () => {
    const userId = BigInt(1);

    it('should throw BAD_REQUEST for invalid cursor', async () => {
      await expect(service.getForYouFeed(userId, 'invalid-cursor', 10)).rejects.toThrow(
        new HttpException(
          {
            message: PAGINATION_ERROR_MESSAGES.INVALID_CURSOR,
            code: PAGINATION_ERROR_CODES.INVALID_CURSOR,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw GONE when feed expired while scrolling', async () => {
      const cursor = encodeCompositeCursor({ score: 100, id: '123' });
      mockRedisClient.get.mockResolvedValue(null);

      await expect(service.getForYouFeed(userId, cursor, 10)).rejects.toThrow(
        new HttpException(
          {
            message: 'For You feed expired, please refresh to get new content.',
            code: 'FOR_YOU_FEED_EXPIRED',
          },
          HttpStatus.GONE,
        ),
      );
    });

    it('should generate new feed on refresh when no cache exists', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.exists.mockResolvedValue(0);
      mockRedisClient.del.mockResolvedValue(undefined);
      mockRedisClient.set.mockResolvedValue(undefined);
      mockRedisClient.smembers.mockResolvedValue([]);
      mockRedisClient.sadd.mockResolvedValue(undefined);
      mockRedisClient.expire.mockResolvedValue(undefined);

      mockUsersRepository.getUserInterests.mockResolvedValue([]);
      mockTweetsRepository.getTimelineForUser.mockResolvedValue([]);
      mockRedisClient.zrevrange.mockResolvedValue([]);

      const result = await service.getForYouFeed(userId, undefined, 10);

      expect(result.items).toEqual([]);
      expect(mockUsersRepository.getUserInterests).toHaveBeenCalled();
    });

    it('should use cached feed on scroll', async () => {
      const cachedFeed = {
        tweets: [{ id: '123', score: 100 }],
        generatedAt: Date.now() - 60000,
      };
      const cursor = encodeCompositeCursor({ score: 200, id: '456' });

      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedFeed));
      mockRedisClient.expire.mockResolvedValue(undefined);
      mockRedisClient.smembers.mockResolvedValue([]);

      mockTweetsRepository.getTweetsByIds.mockResolvedValue([]);

      const result = await service.getForYouFeed(userId, cursor, 10);

      expect(result).toBeDefined();
      expect(mockRedisClient.expire).toHaveBeenCalled();
    });

    it('should filter out seen tweets on refresh', async () => {
      const cachedFeed = {
        tweets: [
          { id: '123', score: 100 },
          { id: '456', score: 90 },
        ],
        generatedAt: Date.now() - 60000,
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedFeed));
      mockRedisClient.smembers.mockResolvedValue(['123']);
      mockRedisClient.sadd.mockResolvedValue(undefined);
      mockRedisClient.expire.mockResolvedValue(undefined);

      mockTweetsRepository.getTweetsByIds.mockResolvedValue([]);

      const result = await service.getForYouFeed(userId, undefined, 10);

      expect(result).toBeDefined();
      expect(mockRedisClient.smembers).toHaveBeenCalled();
    });

    it('should regenerate when all tweets are seen on refresh', async () => {
      const cachedFeed = {
        tweets: [{ id: '123', score: 100 }],
        generatedAt: Date.now() - 60000,
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedFeed));
      mockRedisClient.smembers.mockResolvedValue(['123']);
      mockRedisClient.del.mockResolvedValue(undefined);
      mockRedisClient.sadd.mockResolvedValue(undefined);
      mockRedisClient.expire.mockResolvedValue(undefined);

      mockTweetsRepository.getTweetsByIds.mockResolvedValue([]);

      const result = await service.getForYouFeed(userId, undefined, 10);

      expect(result).toBeDefined();
      expect(mockRedisClient.del).toHaveBeenCalled();
    });

    it('should return empty when scrolling reaches end of feed', async () => {
      const cachedFeed = {
        tweets: [{ id: '123', score: 100 }],
        generatedAt: Date.now() - 60000,
      };
      const cursor = encodeCompositeCursor({ score: 50, id: '000' });

      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedFeed));
      mockRedisClient.expire.mockResolvedValue(undefined);
      mockRedisClient.smembers.mockResolvedValue([]);

      const result = await service.getForYouFeed(userId, cursor, 10);

      expect(result.items).toEqual([]);
      expect(result.pagination.hasNextPage).toBe(false);
    });
  });

  describe('backfillDynamicDataToCache', () => {
    it('should backfill counts from DB to cache', async () => {
      const missingCounts = [BigInt(123)];
      const likeCountsMap = new Map<bigint, number>();
      const retweetCountsMap = new Map<bigint, number>();
      const replyCountsMap = new Map<bigint, number>();

      mockTweetsRepository.getTweetCounts.mockResolvedValue(
        new Map([['123', { likeCounts: 10, retweetCounts: 5, replyCounts: 2 }]]),
      );
      mockPipeline.exec.mockResolvedValue([]);

      await service.backfillDynamicDataToCache(
        missingCounts,
        likeCountsMap,
        retweetCountsMap,
        replyCountsMap,
      );

      expect(mockTweetsRepository.getTweetCounts).toHaveBeenCalledWith(missingCounts);
      expect(likeCountsMap.get(BigInt(123))).toBe(10);
      expect(retweetCountsMap.get(BigInt(123))).toBe(5);
      expect(replyCountsMap.get(BigInt(123))).toBe(2);
      expect(mockPipeline.set).toHaveBeenCalledTimes(3);
    });
  });

  describe('hydrateStaticQuoteData - error paths', () => {
    beforeEach(() => {
      mockTweetsRepository.getTweetsByIds.mockResolvedValue([]);
      mockTweetsRepository.getCompactAuthorsByIds.mockResolvedValue([]);
    });

    it('should handle tweet hydration error and backfill from DB', async () => {
      mockPipeline.exec
        .mockResolvedValueOnce([[new Error('Redis error'), null]])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockTweetsRepository.getTweetsByIds.mockResolvedValue([
        { id: '999', authorId: '888', content: 'Recovered' },
      ]);
      mockTweetsRepository.getCompactAuthorsByIds.mockResolvedValue([
        { id: '888', username: 'author' },
      ]);

      const result = await service.hydrateStaticQuoteData(['999']);

      expect(result).toBeDefined();
      expect(mockTweetsRepository.getTweetsByIds).toHaveBeenCalled();
    });

    it('should handle author hydration error and backfill from DB', async () => {
      const tweetData = { id: '999', authorId: '888', content: 'Quote' };

      mockPipeline.exec
        .mockResolvedValueOnce([[null, JSON.stringify(tweetData)]])
        .mockResolvedValueOnce([[new Error('Author error'), null]])
        .mockResolvedValueOnce([]);

      mockTweetsRepository.getCompactAuthorsByIds.mockResolvedValue([
        { id: '888', username: 'author' },
      ]);

      const result = await service.hydrateStaticQuoteData(['999']);

      expect(result.tweets.has('999')).toBe(true);
      expect(mockTweetsRepository.getCompactAuthorsByIds).toHaveBeenCalled();
    });

    it('should handle null authors hydration results', async () => {
      const tweetData = { id: '999', authorId: '888', content: 'Quote' };

      mockPipeline.exec
        .mockResolvedValueOnce([[null, JSON.stringify(tweetData)]])
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce([]);

      const result = await service.hydrateStaticQuoteData(['999']);

      expect(result.tweets.has('999')).toBe(true);
      expect(result.authors.size).toBe(0);
    });
  });

  describe('timelineCacheMiss - population tests', () => {
    const userId = BigInt(1);

    it('should populate cache with tweets and retweets from DB', async () => {
      mockTweetsRepository.getTimelineForUser.mockResolvedValue([
        {
          id: BigInt(123),
          authorId: BigInt(456),
          createdAt: new Date(),
          retweeterId: null,
        },
        {
          id: BigInt(124),
          authorId: BigInt(457),
          createdAt: new Date(),
          retweeterId: BigInt(789),
        },
      ]);
      mockPipeline.exec.mockResolvedValue([]);

      mockRedisClient.exists.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      mockRedisClient.zrevrangebyscore.mockResolvedValue([]);

      await service.getTimeline(userId, undefined, 10);

      expect(mockTweetsRepository.getTimelineForUser).toHaveBeenCalled();
      expect(mockPipeline.zadd).toHaveBeenCalled();
      expect(mockPipeline.expire).toHaveBeenCalled();
    });
  });

  describe('generateForYouFeed - scoring tests', () => {
    const userId = BigInt(1);

    it('should generate feed with interests and engagement scoring', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.exists.mockResolvedValue(0);
      mockRedisClient.del.mockResolvedValue(undefined);
      mockRedisClient.set.mockResolvedValue(undefined);
      mockRedisClient.smembers.mockResolvedValue([]);
      mockRedisClient.sadd.mockResolvedValue(undefined);
      mockRedisClient.expire.mockResolvedValue(undefined);
      mockRedisClient.zrevrange.mockResolvedValue(['456:123:T', String(Date.now())]);

      mockUsersRepository.getUserInterests.mockResolvedValue(['tech', 'sports']);
      mockTweetsRepository.getTimelineForUser.mockResolvedValue([]);
      mockTweetsRepository.getTweetsMatchingInterests.mockResolvedValue([
        { id: '789', authorId: '555', createdAt: new Date() },
      ]);
      mockTweetsRepository.filterNonMutedAuthors.mockResolvedValue([BigInt(456), BigInt(555)]);
      mockTweetsRepository.filterValidTweets.mockResolvedValue([BigInt(123), BigInt(789)]);
      mockTweetsRepository.getTweetCounts.mockResolvedValue(
        new Map([
          ['123', { likeCounts: 10, retweetCounts: 5, replyCounts: 2 }],
          ['789', { likeCounts: 20, retweetCounts: 8, replyCounts: 5 }],
        ]),
      );
      mockUsersRepository.getFollowingIds.mockResolvedValue([BigInt(456)]);

      const result = await service.getForYouFeed(userId, undefined, 10);

      expect(result).toBeDefined();
      expect(mockUsersRepository.getUserInterests).toHaveBeenCalled();
      expect(mockTweetsRepository.getTweetsMatchingInterests).toHaveBeenCalled();
    });

    it('should handle retweets in timeline candidates', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.exists.mockResolvedValue(0);
      mockRedisClient.del.mockResolvedValue(undefined);
      mockRedisClient.set.mockResolvedValue(undefined);
      mockRedisClient.smembers.mockResolvedValue([]);
      mockRedisClient.sadd.mockResolvedValue(undefined);
      mockRedisClient.expire.mockResolvedValue(undefined);
      mockRedisClient.zrevrange.mockResolvedValue(['456:123:R:789', String(Date.now())]);

      mockUsersRepository.getUserInterests.mockResolvedValue([]);
      mockTweetsRepository.getTimelineForUser.mockResolvedValue([]);
      mockTweetsRepository.filterNonMutedAuthors.mockResolvedValue([BigInt(456)]);
      mockTweetsRepository.filterValidTweets.mockResolvedValue([BigInt(123)]);
      mockTweetsRepository.getTweetCounts.mockResolvedValue(
        new Map([['123', { likeCounts: 5, retweetCounts: 3, replyCounts: 1 }]]),
      );
      mockUsersRepository.getFollowingIds.mockResolvedValue([BigInt(456)]);

      const result = await service.getForYouFeed(userId, undefined, 10);

      expect(result).toBeDefined();
    });

    it('should return empty when no valid candidates', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.exists.mockResolvedValue(0);
      mockRedisClient.del.mockResolvedValue(undefined);
      mockRedisClient.set.mockResolvedValue(undefined);
      mockRedisClient.smembers.mockResolvedValue([]);
      mockRedisClient.expire.mockResolvedValue(undefined);
      mockRedisClient.zrevrange.mockResolvedValue(['456:123:T', String(Date.now())]);

      mockUsersRepository.getUserInterests.mockResolvedValue([]);
      mockTweetsRepository.getTimelineForUser.mockResolvedValue([]);
      mockTweetsRepository.filterNonMutedAuthors.mockResolvedValue([]);
      mockTweetsRepository.filterValidTweets.mockResolvedValue([]);
      mockUsersRepository.getFollowingIds.mockResolvedValue([]);

      const result = await service.getForYouFeed(userId, undefined, 10);

      expect(result.items).toEqual([]);
    });

    it('should regenerate feed when fresh TTL expired', async () => {
      const oldFeed = {
        tweets: [{ id: '123', score: 100 }],
        generatedAt: Date.now() - 400000,
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(oldFeed));
      mockRedisClient.exists.mockResolvedValue(0);
      mockRedisClient.del.mockResolvedValue(undefined);
      mockRedisClient.set.mockResolvedValue(undefined);
      mockRedisClient.smembers.mockResolvedValue([]);
      mockRedisClient.sadd.mockResolvedValue(undefined);
      mockRedisClient.expire.mockResolvedValue(undefined);
      mockRedisClient.zrevrange.mockResolvedValue([]);

      mockUsersRepository.getUserInterests.mockResolvedValue([]);
      mockTweetsRepository.getTimelineForUser.mockResolvedValue([]);

      const result = await service.getForYouFeed(userId, undefined, 10);

      expect(result).toBeDefined();
      expect(mockRedisClient.del).toHaveBeenCalled();
    });
  });

  describe('timelineCacheHit - batching and pagination', () => {
    const userId = BigInt(1);

    it('should handle batching when fetching more items than limit', async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      // First batch returns 5 items
      mockRedisClient.zrevrangebyscore
        .mockResolvedValueOnce(['456:123:T', '456:124:T', '456:125:T', '456:126:T', '456:127:T'])
        .mockResolvedValueOnce([]);

      mockTweetsRepository.filterValidAuthors.mockResolvedValue([BigInt(456)]);
      mockTweetsRepository.filterValidTweets.mockResolvedValue([
        BigInt(123),
        BigInt(124),
        BigInt(125),
      ]);

      mockRedisClient.zscore.mockResolvedValue(String(Date.now()));

      mockPipeline.exec
        .mockResolvedValueOnce([
          [
            null,
            JSON.stringify({
              id: '123',
              authorId: '456',
              content: 'Tweet 1',
              createdAt: new Date().toISOString(),
            }),
          ],
          [
            null,
            JSON.stringify({
              id: '456',
              username: 'testuser',
              displayName: 'Test',
              avatarUrl: DEFAULT_PROFILE_PICTURE,
            }),
          ],
          [
            null,
            JSON.stringify({
              id: '124',
              authorId: '456',
              content: 'Tweet 2',
              createdAt: new Date().toISOString(),
            }),
          ],
          [
            null,
            JSON.stringify({
              id: '456',
              username: 'testuser',
              displayName: 'Test',
              avatarUrl: DEFAULT_PROFILE_PICTURE,
            }),
          ],
          [
            null,
            JSON.stringify({
              id: '125',
              authorId: '456',
              content: 'Tweet 3',
              createdAt: new Date().toISOString(),
            }),
          ],
          [
            null,
            JSON.stringify({
              id: '456',
              username: 'testuser',
              displayName: 'Test',
              avatarUrl: DEFAULT_PROFILE_PICTURE,
            }),
          ],
        ])
        .mockResolvedValueOnce([
          [null, '5'],
          [null, '2'],
          [null, '1'],
          [null, '3'],
          [null, '1'],
          [null, '0'],
          [null, '4'],
          [null, '0'],
          [null, '1'],
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockTweetsRepository.getTweetsByIds.mockResolvedValue([]);
      mockTweetsRepository.getCompactAuthorsByIds.mockResolvedValue([]);
      mockTweetsRepository.getUserTweetInteractions.mockResolvedValue(new Map());
      mockTweetsRepository.getAuthorRelationships.mockResolvedValue(
        new Map([
          [
            '456',
            {
              id: '456',
              username: 'testuser',
              displayName: 'Test',
              avatarUrl: DEFAULT_PROFILE_PICTURE,
              relationship: { following: false, follower: false },
            },
          ],
        ]),
      );

      const result = await service.timelineCacheHit(userId, undefined, 3, new Set());

      expect(result.length).toBeGreaterThan(0);
    });

    it('should continue fetching batches until limit is reached', async () => {
      mockRedisClient.exists.mockResolvedValue(0);
      mockRedisClient.zrevrangebyscore
        .mockResolvedValueOnce(['456:123:T'])
        .mockResolvedValueOnce(['456:124:T'])
        .mockResolvedValueOnce([]);

      mockTweetsRepository.filterValidAuthors.mockResolvedValue([BigInt(456)]);
      mockTweetsRepository.filterValidTweets.mockResolvedValue([BigInt(123), BigInt(124)]);

      mockRedisClient.zscore.mockResolvedValue(String(Date.now()));

      mockPipeline.exec
        .mockResolvedValueOnce([
          [
            null,
            JSON.stringify({
              id: '123',
              authorId: '456',
              content: 'Tweet 1',
              createdAt: new Date().toISOString(),
            }),
          ],
          [
            null,
            JSON.stringify({
              id: '456',
              username: 'testuser',
              displayName: 'Test',
              avatarUrl: DEFAULT_PROFILE_PICTURE,
            }),
          ],
        ])
        .mockResolvedValueOnce([
          [null, '5'],
          [null, '2'],
          [null, '1'],
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          [
            null,
            JSON.stringify({
              id: '124',
              authorId: '456',
              content: 'Tweet 2',
              createdAt: new Date().toISOString(),
            }),
          ],
          [
            null,
            JSON.stringify({
              id: '456',
              username: 'testuser',
              displayName: 'Test',
              avatarUrl: DEFAULT_PROFILE_PICTURE,
            }),
          ],
        ])
        .mockResolvedValueOnce([
          [null, '3'],
          [null, '1'],
          [null, '0'],
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockTweetsRepository.getTweetsByIds.mockResolvedValue([]);
      mockTweetsRepository.getCompactAuthorsByIds.mockResolvedValue([]);
      mockTweetsRepository.getUserTweetInteractions.mockResolvedValue(new Map());
      mockTweetsRepository.getAuthorRelationships.mockResolvedValue(
        new Map([
          [
            '456',
            {
              id: '456',
              username: 'testuser',
              displayName: 'Test',
              avatarUrl: DEFAULT_PROFILE_PICTURE,
              relationship: { following: false, follower: false },
            },
          ],
        ]),
      );

      const result = await service.timelineCacheHit(userId, undefined, 10, new Set());

      expect(result).toBeDefined();
    });
  });

  describe('getTweetCreatedAt', () => {
    const userId = BigInt(1);

    it('should return tweet created date from Redis score', async () => {
      const now = Date.now();
      mockRedisClient.zscore.mockResolvedValue(String(now));

      const result = await service['getTweetCreatedAt'](userId, '456:123:T');

      expect(result).toEqual(new Date(now));
      expect(mockRedisClient.zscore).toHaveBeenCalled();
    });

    it('should return null when tweet score not found in Redis', async () => {
      mockRedisClient.zscore.mockResolvedValue(null);

      const result = await service['getTweetCreatedAt'](userId, '456:123:T');

      expect(result).toBeNull();
    });
  });

  describe('hydrateStaticData - retweet hydration', () => {
    const userId = BigInt(1);

    it('should hydrate retweeter data for retweets', async () => {
      mockRedisClient.exists.mockResolvedValue(0);
      mockRedisClient.zrevrangebyscore.mockResolvedValue(['456:123:R:789']);

      mockTweetsRepository.filterValidAuthors.mockResolvedValue([BigInt(456), BigInt(789)]);
      mockTweetsRepository.filterValidTweets.mockResolvedValue([BigInt(123)]);

      mockPipeline.exec
        .mockResolvedValueOnce([
          [
            null,
            JSON.stringify({
              id: '123',
              authorId: '456',
              content: 'Original tweet',
              createdAt: new Date().toISOString(),
            }),
          ],
          [
            null,
            JSON.stringify({
              id: '456',
              username: 'author',
              displayName: 'Author',
              avatarUrl: DEFAULT_PROFILE_PICTURE,
            }),
          ],
          [
            null,
            JSON.stringify({
              id: '789',
              username: 'retweeter',
              displayName: 'Retweeter',
              avatarUrl: DEFAULT_PROFILE_PICTURE,
            }),
          ],
        ])
        .mockResolvedValueOnce([
          [null, '5'],
          [null, '2'],
          [null, '1'],
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockTweetsRepository.getTweetsByIds.mockResolvedValue([]);
      mockTweetsRepository.getCompactAuthorsByIds.mockResolvedValue([]);
      mockTweetsRepository.getUserTweetInteractions.mockResolvedValue(new Map());
      mockTweetsRepository.getAuthorRelationships.mockResolvedValue(
        new Map([
          [
            '456',
            {
              id: '456',
              username: 'author',
              displayName: 'Author',
              avatarUrl: DEFAULT_PROFILE_PICTURE,
              relationship: { following: false, follower: false },
            },
          ],
        ]),
      );

      const result = await service.timelineCacheHit(userId, undefined, 10, new Set());

      expect(result).toBeDefined();
      expect(mockPipeline.getex).toHaveBeenCalled();
    });

    it('should handle missing retweeter data and add to missingAuthorIds', async () => {
      mockRedisClient.exists.mockResolvedValue(0);
      mockRedisClient.zrevrangebyscore.mockResolvedValue(['456:123:R:789']);

      mockTweetsRepository.filterValidAuthors.mockResolvedValue([BigInt(456), BigInt(789)]);
      mockTweetsRepository.filterValidTweets.mockResolvedValue([BigInt(123)]);

      mockPipeline.exec
        .mockResolvedValueOnce([
          [
            null,
            JSON.stringify({
              id: '123',
              authorId: '456',
              content: 'Original tweet',
              createdAt: new Date().toISOString(),
            }),
          ],
          [
            null,
            JSON.stringify({
              id: '456',
              username: 'author',
              displayName: 'Author',
              avatarUrl: DEFAULT_PROFILE_PICTURE,
            }),
          ],
          [null, null],
        ])
        .mockResolvedValueOnce([
          [null, '5'],
          [null, '2'],
          [null, '1'],
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockTweetsRepository.getTweetsByIds.mockResolvedValue([]);
      mockTweetsRepository.getCompactAuthorsByIds.mockResolvedValue([
        {
          id: '789',
          username: 'retweeter',
          displayName: 'Retweeter',
          avatarUrl: DEFAULT_PROFILE_PICTURE,
        },
      ]);
      mockTweetsRepository.getUserTweetInteractions.mockResolvedValue(new Map());
      mockTweetsRepository.getAuthorRelationships.mockResolvedValue(
        new Map([
          [
            '456',
            { id: '456', username: 'author', relationship: { following: false, follower: false } },
          ],
        ]),
      );

      const result = await service.timelineCacheHit(userId, undefined, 10, new Set());

      expect(result).toBeDefined();
    });
  });

  describe('extractIdsFromTimelineItems', () => {
    it('should extract author and tweet IDs including retweeters', () => {
      const items = ['456:123:T', '789:124:R:101'];

      const result = service['extractIdsFromTimelineItems'](items);

      expect(result.authorIds.has(BigInt(456))).toBe(true);
      expect(result.authorIds.has(BigInt(789))).toBe(true);
      expect(result.authorIds.has(BigInt(101))).toBe(true);
      expect(result.tweetIds.has(BigInt(123))).toBe(true);
      expect(result.tweetIds.has(BigInt(124))).toBe(true);
    });
  });

  describe('fetchAndValidateForYouTweets - batch processing', () => {
    const userId = BigInt(1);

    it('should process tweets in batches and accumulate valid tweets', async () => {
      const rankedFeed = {
        tweets: [
          { id: '123', score: 100 },
          { id: '124', score: 90 },
          { id: '125', score: 80 },
        ],
        generatedAt: Date.now(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(rankedFeed));
      mockRedisClient.smembers.mockResolvedValue([]);
      mockRedisClient.sadd.mockResolvedValue(undefined);
      mockRedisClient.expire.mockResolvedValue(undefined);

      mockTweetsRepository.getTweetsByIds.mockResolvedValue([
        { id: '123', authorId: '456', content: 'Tweet 1', createdAt: new Date() },
        { id: '124', authorId: '457', content: 'Tweet 2', createdAt: new Date() },
        { id: '125', authorId: '458', content: 'Tweet 3', createdAt: new Date() },
      ]);

      mockPipeline.exec
        .mockResolvedValueOnce([
          [
            null,
            JSON.stringify({
              id: '123',
              authorId: '456',
              content: 'Tweet 1',
              createdAt: new Date().toISOString(),
            }),
          ],
          [
            null,
            JSON.stringify({
              id: '456',
              username: 'user1',
              displayName: 'User 1',
              avatarUrl: DEFAULT_PROFILE_PICTURE,
            }),
          ],
          [
            null,
            JSON.stringify({
              id: '124',
              authorId: '457',
              content: 'Tweet 2',
              createdAt: new Date().toISOString(),
            }),
          ],
          [
            null,
            JSON.stringify({
              id: '457',
              username: 'user2',
              displayName: 'User 2',
              avatarUrl: DEFAULT_PROFILE_PICTURE,
            }),
          ],
          [
            null,
            JSON.stringify({
              id: '125',
              authorId: '458',
              content: 'Tweet 3',
              createdAt: new Date().toISOString(),
            }),
          ],
          [
            null,
            JSON.stringify({
              id: '458',
              username: 'user3',
              displayName: 'User 3',
              avatarUrl: DEFAULT_PROFILE_PICTURE,
            }),
          ],
        ])
        .mockResolvedValueOnce([
          [null, '5'],
          [null, '2'],
          [null, '1'],
          [null, '6'],
          [null, '3'],
          [null, '2'],
          [null, '7'],
          [null, '4'],
          [null, '3'],
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockTweetsRepository.getTweetsByIds.mockResolvedValue([]);
      mockTweetsRepository.getCompactAuthorsByIds.mockResolvedValue([]);
      mockTweetsRepository.getUserTweetInteractions.mockResolvedValue(new Map());
      mockTweetsRepository.getAuthorRelationships.mockResolvedValue(
        new Map([
          [
            '456',
            { id: '456', username: 'user1', relationship: { following: false, follower: false } },
          ],
          [
            '457',
            { id: '457', username: 'user2', relationship: { following: false, follower: false } },
          ],
          [
            '458',
            { id: '458', username: 'user3', relationship: { following: false, follower: false } },
          ],
        ]),
      );

      const result = await service.getForYouFeed(userId, undefined, 10);

      expect(result).toBeDefined();
    });

    it('should handle For You feed with retweet items', async () => {
      const rankedFeed = {
        tweets: [{ id: '123', score: 100, retweeterId: '789' }],
        generatedAt: Date.now(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(rankedFeed));
      mockRedisClient.smembers.mockResolvedValue([]);
      mockRedisClient.sadd.mockResolvedValue(undefined);
      mockRedisClient.expire.mockResolvedValue(undefined);

      mockTweetsRepository.getTweetsByIds.mockResolvedValue([
        { id: '123', authorId: '456', content: 'Original tweet', createdAt: new Date() },
      ]);

      mockPipeline.exec
        .mockResolvedValueOnce([
          [
            null,
            JSON.stringify({
              id: '123',
              authorId: '456',
              content: 'Original tweet',
              createdAt: new Date().toISOString(),
            }),
          ],
          [
            null,
            JSON.stringify({
              id: '456',
              username: 'author',
              displayName: 'Author',
              avatarUrl: DEFAULT_PROFILE_PICTURE,
            }),
          ],
          [
            null,
            JSON.stringify({
              id: '789',
              username: 'retweeter',
              displayName: 'Retweeter',
              avatarUrl: DEFAULT_PROFILE_PICTURE,
            }),
          ],
        ])
        .mockResolvedValueOnce([
          [null, '5'],
          [null, '2'],
          [null, '1'],
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockTweetsRepository.getTweetsByIds.mockResolvedValue([]);
      mockTweetsRepository.getCompactAuthorsByIds.mockResolvedValue([]);
      mockTweetsRepository.getUserTweetInteractions.mockResolvedValue(new Map());
      mockTweetsRepository.getAuthorRelationships.mockResolvedValue(
        new Map([
          [
            '456',
            { id: '456', username: 'author', relationship: { following: false, follower: false } },
          ],
        ]),
      );

      const result = await service.getForYouFeed(userId, undefined, 10);

      expect(result).toBeDefined();
    });

    it('should deduplicate tweets within the same batch', async () => {
      const rankedFeed = {
        tweets: [
          { id: '123', score: 100 },
          { id: '123', score: 99 },
        ],
        generatedAt: Date.now(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(rankedFeed));
      mockRedisClient.smembers.mockResolvedValue([]);
      mockRedisClient.sadd.mockResolvedValue(undefined);
      mockRedisClient.expire.mockResolvedValue(undefined);

      mockTweetsRepository.getTweetsByIds.mockResolvedValue([
        { id: '123', authorId: '456', content: 'Tweet', createdAt: new Date() },
      ]);

      mockPipeline.exec
        .mockResolvedValueOnce([
          [
            null,
            JSON.stringify({
              id: '123',
              authorId: '456',
              content: 'Tweet',
              createdAt: new Date().toISOString(),
            }),
          ],
          [
            null,
            JSON.stringify({
              id: '456',
              username: 'user',
              displayName: 'User',
              avatarUrl: DEFAULT_PROFILE_PICTURE,
            }),
          ],
        ])
        .mockResolvedValueOnce([
          [null, '5'],
          [null, '2'],
          [null, '1'],
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockTweetsRepository.getTweetsByIds.mockResolvedValue([]);
      mockTweetsRepository.getCompactAuthorsByIds.mockResolvedValue([]);
      mockTweetsRepository.getUserTweetInteractions.mockResolvedValue(new Map());
      mockTweetsRepository.getAuthorRelationships.mockResolvedValue(
        new Map([
          [
            '456',
            { id: '456', username: 'user', relationship: { following: false, follower: false } },
          ],
        ]),
      );

      const result = await service.getForYouFeed(userId, undefined, 10);

      expect(result).toBeDefined();
    });

    it('should skip tweets that no longer exist in DB', async () => {
      const rankedFeed = {
        tweets: [
          { id: '123', score: 100 },
          { id: '124', score: 90 },
        ],
        generatedAt: Date.now(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(rankedFeed));
      mockRedisClient.smembers.mockResolvedValue([]);
      mockRedisClient.sadd.mockResolvedValue(undefined);
      mockRedisClient.expire.mockResolvedValue(undefined);

      mockTweetsRepository.getTweetsByIds.mockResolvedValue([
        { id: '123', authorId: '456', content: 'Tweet 1', createdAt: new Date() },
      ]);

      mockPipeline.exec
        .mockResolvedValueOnce([
          [
            null,
            JSON.stringify({
              id: '123',
              authorId: '456',
              content: 'Tweet 1',
              createdAt: new Date().toISOString(),
            }),
          ],
          [
            null,
            JSON.stringify({
              id: '456',
              username: 'user',
              displayName: 'User',
              avatarUrl: DEFAULT_PROFILE_PICTURE,
            }),
          ],
        ])
        .mockResolvedValueOnce([
          [null, '5'],
          [null, '2'],
          [null, '1'],
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockTweetsRepository.getTweetsByIds.mockResolvedValue([]);
      mockTweetsRepository.getCompactAuthorsByIds.mockResolvedValue([]);
      mockTweetsRepository.getUserTweetInteractions.mockResolvedValue(new Map());
      mockTweetsRepository.getAuthorRelationships.mockResolvedValue(
        new Map([
          [
            '456',
            { id: '456', username: 'user', relationship: { following: false, follower: false } },
          ],
        ]),
      );

      const result = await service.getForYouFeed(userId, undefined, 10);

      expect(result).toBeDefined();
    });
  });
});
