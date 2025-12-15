import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { TweetAnalyzeService } from 'src/tweet-analyze/tweet-analyze.service';
import { TweetAnalyzeRepository } from 'src/tweet-analyze/tweet-analyze.repository';
import { RedisService } from 'src/redis/redis.service';
import { TrendingService } from 'src/trending/trending.service';
import { of, throwError } from 'rxjs';
import type {
  ModelApiResponse,
  TrendingKeyword,
  ClassifiedTweet,
} from 'src/tweet-analyze/interfaces';
import { AxiosResponse } from 'axios';

describe('TweetAnalyzeService', () => {
  let service: TweetAnalyzeService;
  let configService: jest.Mocked<ConfigService>;
  let httpService: jest.Mocked<HttpService>;
  let repository: jest.Mocked<TweetAnalyzeRepository>;
  let redisService: jest.Mocked<RedisService>;
  let trendingService: jest.Mocked<TrendingService>;

  const mockRedisClient = {
    set: jest.fn(),
    expire: jest.fn(),
    del: jest.fn(),
  };

  const createMockConfigService = () => ({
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        CLASSIFY_TWEETS: 'true',
        CLASSIFICATION_INTERVAL_MINUTES: '5',
        CLASSIFY_REQ_LIMIT: '50',
        CLASSIFICATION_API_URL: 'http://localhost:5000/analyze',
      };
      return config[key] || defaultValue;
    }),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TweetAnalyzeService,
        {
          provide: ConfigService,
          useValue: createMockConfigService(),
        },
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
          },
        },
        {
          provide: TweetAnalyzeRepository,
          useValue: {
            findTweetsToClassify: jest.fn(),
            updateTweetClass: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn(() => mockRedisClient),
            del: jest.fn(),
          },
        },
        {
          provide: TrendingService,
          useValue: {
            updateTrendScores: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TweetAnalyzeService>(TweetAnalyzeService);
    configService = module.get(ConfigService);
    httpService = module.get(HttpService);
    repository = module.get(TweetAnalyzeRepository);
    redisService = module.get(RedisService);
    trendingService = module.get(TrendingService);
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with correct configuration', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(configService.get).toHaveBeenCalledWith('CLASSIFY_TWEETS');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(configService.get).toHaveBeenCalledWith('CLASSIFICATION_INTERVAL_MINUTES');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(configService.get).toHaveBeenCalledWith('CLASSIFY_REQ_LIMIT');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(configService.get).toHaveBeenCalledWith('CLASSIFICATION_API_URL', '/analyze');
    });
  });

  describe('analyzeTweets', () => {
    const mockTweets = [
      { id: BigInt(1), content: 'Test tweet 1' },
      { id: BigInt(2), content: 'Test tweet 2' },
      { id: BigInt(3), content: 'Test tweet 3' },
    ];

    const mockClassifiedTweets: ClassifiedTweet[] = [
      { id: '1', class: 'technology' },
      { id: '2', class: 'sports' },
      { id: '3', class: 'entertainment' },
    ];

    const mockTrendingKeywords: TrendingKeyword[] = [
      {
        keyword: 'AI',
        general_trend_score: 0.95,
        top_related_topics: [
          {
            topic: 'technology',
            trend_score: 0.9,
            occurence_in_category: 10,
          },
        ],
      },
    ];

    const mockApiResponse: ModelApiResponse = {
      batch_meta: { total_tweets: 3 },
      trending_keywords: mockTrendingKeywords,
      tweets_detail: mockClassifiedTweets,
    };

    beforeEach(() => {
      // Mock lock acquisition success
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.expire.mockResolvedValue(1);
      redisService.del.mockResolvedValue(1);

      // Default: return tweets once, then empty
      repository.findTweetsToClassify.mockResolvedValueOnce(mockTweets).mockResolvedValue([]);
      repository.updateTweetClass.mockResolvedValue(undefined);
      trendingService.updateTrendScores.mockResolvedValue(undefined);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const axiosResponse = {
        data: mockApiResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: undefined,
        },
      } as AxiosResponse<ModelApiResponse>;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      httpService.post.mockReturnValue(of(axiosResponse));
    });

    it('should skip analysis when disabled', async () => {
      const disabledConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'CLASSIFY_TWEETS') return 'false';
          if (key === 'CLASSIFICATION_INTERVAL_MINUTES') return '5';
          if (key === 'CLASSIFY_REQ_LIMIT') return '50';
          if (key === 'CLASSIFICATION_API_URL') return 'http://localhost:5000/analyze';
          return '';
        }),
      } as unknown as ConfigService;

      const disabledService = new TweetAnalyzeService(
        disabledConfigService,
        httpService,
        repository,
        redisService,
        trendingService,
      );

      await disabledService.analyzeTweets();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.findTweetsToClassify).not.toHaveBeenCalled();
    });

    it('should skip when lock cannot be acquired', async () => {
      mockRedisClient.set.mockResolvedValue(null);

      await service.analyzeTweets();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.findTweetsToClassify).not.toHaveBeenCalled();
    });

    it('should successfully analyze tweets', async () => {
      await service.analyzeTweets();

      expect(mockRedisClient.set).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.findTweetsToClassify).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(httpService.post).toHaveBeenCalledWith('http://localhost:5000/analyze', {
        tweets: [
          { id: '1', content: 'Test tweet 1' },
          { id: '2', content: 'Test tweet 2' },
          { id: '3', content: 'Test tweet 3' },
        ],
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.updateTweetClass).toHaveBeenCalledTimes(3);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(trendingService.updateTrendScores).toHaveBeenCalledWith({
        batch_meta: { total_tweets: 3 },
        trending_keywords: mockTrendingKeywords,
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(redisService.del).toHaveBeenCalled();
    });

    it('should handle no tweets to analyze', async () => {
      repository.findTweetsToClassify.mockReset().mockResolvedValue([]);

      await service.analyzeTweets();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(httpService.post).not.toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(trendingService.updateTrendScores).not.toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(redisService.del).toHaveBeenCalled();
    });

    it('should split tweets into multiple batches', async () => {
      const manyTweets = Array.from({ length: 100 }, (_, i) => ({
        id: BigInt(i + 1),
        content: `Tweet ${i + 1}`,
      }));

      repository.findTweetsToClassify
        .mockReset()
        .mockResolvedValueOnce(manyTweets)
        .mockResolvedValue([]);

      await service.analyzeTweets();

      // Should make 2 calls: 50, 50 (based on CLASSIFY_REQ_LIMIT=50)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(httpService.post).toHaveBeenCalledTimes(2);
    });

    it('should handle API errors gracefully', async () => {
      httpService.post.mockReturnValue(throwError(() => new Error('API connection failed')));

      await service.analyzeTweets();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.updateTweetClass).not.toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(redisService.del).toHaveBeenCalled();
    });

    it('should handle partial batch failures', async () => {
      const largeBatch = Array.from({ length: 100 }, (_, i) => ({
        id: BigInt(i + 1),
        content: `Tweet ${i + 1}`,
      }));

      repository.findTweetsToClassify
        .mockReset()
        .mockResolvedValueOnce(largeBatch)
        .mockResolvedValue([]);

      // First batch succeeds, second batch fails
      httpService.post
        .mockReturnValueOnce(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          of({
            data: mockApiResponse,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {
              headers: undefined,
            },
          } as AxiosResponse<ModelApiResponse>),
        )
        .mockReturnValueOnce(throwError(() => new Error('Batch 2 failed')));

      await service.analyzeTweets();

      // First batch should have been processed
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.updateTweetClass).toHaveBeenCalledTimes(3);
      // Should stop after first batch failure
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(httpService.post).toHaveBeenCalledTimes(2);
    });

    it('should filter out tweets with null content', async () => {
      const tweetsWithNull = [
        { id: BigInt(1), content: 'Valid tweet' },
        { id: BigInt(2), content: null },
        { id: BigInt(3), content: 'Another valid tweet' },
      ];

      repository.findTweetsToClassify
        .mockReset()
        .mockResolvedValueOnce(tweetsWithNull)
        .mockResolvedValue([]);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const axiosResponse = {
        data: {
          batch_meta: { total_tweets: 2 },
          trending_keywords: [],
          tweets_detail: [
            { id: '1', class: 'technology' },
            { id: '3', class: 'sports' },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: undefined,
        },
      } as AxiosResponse<ModelApiResponse>;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      httpService.post.mockReturnValue(of(axiosResponse));

      await service.analyzeTweets();

      // Should only process tweets with valid content
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(httpService.post).toHaveBeenCalledWith('http://localhost:5000/analyze', {
        tweets: [
          { id: '1', content: 'Valid tweet' },
          { id: '3', content: 'Another valid tweet' },
        ],
      });
    });

    it('should handle empty API response', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const emptyResponse = {
        data: {
          batch_meta: { total_tweets: 0 },
          trending_keywords: [],
          tweets_detail: [],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: undefined,
        },
      } as AxiosResponse<ModelApiResponse>;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      httpService.post.mockReset().mockReturnValue(of(emptyResponse));

      await service.analyzeTweets();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.updateTweetClass).not.toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(trendingService.updateTrendScores).not.toHaveBeenCalled();
    });

    it('should process multiple runs when tweets exceed LIMIT_PER_JOB', async () => {
      // Create 150 tweets to trigger multiple runs (LIMIT_PER_JOB = 100)
      const manyTweets = Array.from({ length: 150 }, (_, i) => ({
        id: BigInt(i + 1),
        content: `Tweet ${i + 1}`,
      }));

      // First call returns 150 tweets (will process 100), second call returns remaining 50
      repository.findTweetsToClassify
        .mockReset()
        .mockResolvedValueOnce(manyTweets)
        .mockResolvedValueOnce(manyTweets.slice(100))
        .mockResolvedValue([]);

      await service.analyzeTweets();

      // Should fetch tweets at least 2 times (run 1: 150 found -> process 100, run 2: 50 found -> process 50)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.findTweetsToClassify).toHaveBeenCalledTimes(2);
    });

    it('should release lock even when errors occur', async () => {
      repository.findTweetsToClassify.mockReset().mockRejectedValue(new Error('Database error'));

      await service.analyzeTweets();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(redisService.del).toHaveBeenCalled();
    });

    it('should handle tweet update failures gracefully', async () => {
      repository.updateTweetClass
        .mockReset()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Update failed'))
        .mockResolvedValueOnce(undefined);

      await service.analyzeTweets();

      // Should continue updating other tweets even if one fails
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.updateTweetClass).toHaveBeenCalledTimes(3);
    });

    it('should accumulate trending keywords across multiple batches', async () => {
      const largeBatch = Array.from({ length: 100 }, (_, i) => ({
        id: BigInt(i + 1),
        content: `Tweet ${i + 1}`,
      }));

      repository.findTweetsToClassify
        .mockReset()
        .mockResolvedValueOnce(largeBatch)
        .mockResolvedValue([]);

      const batch1Keywords: TrendingKeyword[] = [
        {
          keyword: 'AI',
          general_trend_score: 0.9,
          top_related_topics: [{ topic: 'tech', trend_score: 0.8, occurence_in_category: 5 }],
        },
      ];

      const batch2Keywords: TrendingKeyword[] = [
        {
          keyword: 'ML',
          general_trend_score: 0.85,
          top_related_topics: [{ topic: 'tech', trend_score: 0.75, occurence_in_category: 3 }],
        },
      ];

      httpService.post
        .mockReset()
        .mockReturnValueOnce(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          of({
            data: {
              batch_meta: { total_tweets: 50 },
              trending_keywords: batch1Keywords,
              tweets_detail: mockClassifiedTweets,
            },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {
              headers: undefined,
            },
          } as AxiosResponse<ModelApiResponse>),
        )
        .mockReturnValueOnce(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          of({
            data: {
              batch_meta: { total_tweets: 50 },
              trending_keywords: batch2Keywords,
              tweets_detail: mockClassifiedTweets,
            },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {
              headers: undefined,
            },
          } as AxiosResponse<ModelApiResponse>),
        );

      await service.analyzeTweets();

      // Should accumulate keywords from both batches
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(trendingService.updateTrendScores).toHaveBeenCalledWith({
        batch_meta: { total_tweets: 100 },
        trending_keywords: [...batch1Keywords, ...batch2Keywords],
      });
    });

    it('should correctly convert tweet IDs to strings for API', async () => {
      const largeIdTweets = [{ id: BigInt('9999999999999999'), content: 'Large ID tweet' }];

      repository.findTweetsToClassify
        .mockReset()
        .mockResolvedValueOnce(largeIdTweets)
        .mockResolvedValue([]);

      await service.analyzeTweets();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(httpService.post).toHaveBeenCalledWith('http://localhost:5000/analyze', {
        tweets: [{ id: '9999999999999999', content: 'Large ID tweet' }],
      });
    });

    it('should correctly convert string IDs back to BigInt for database updates', async () => {
      await service.analyzeTweets();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.updateTweetClass).toHaveBeenCalledWith(BigInt(1), 'technology');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.updateTweetClass).toHaveBeenCalledWith(BigInt(2), 'sports');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.updateTweetClass).toHaveBeenCalledWith(BigInt(3), 'entertainment');
    });

    it('should handle lock extension errors gracefully', async () => {
      // Let the lock extension run and fail
      mockRedisClient.expire.mockRejectedValue(new Error('Redis connection lost'));

      await service.analyzeTweets();

      // Should still complete the job
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(redisService.del).toHaveBeenCalled();
    });

    it('should handle lock acquisition errors', async () => {
      mockRedisClient.set.mockRejectedValue(new Error('Redis error'));

      await service.analyzeTweets();

      // Should not proceed with analysis
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.findTweetsToClassify).not.toHaveBeenCalled();
    });

    it('should handle lock release errors gracefully', async () => {
      redisService.del.mockRejectedValue(new Error('Redis error on delete'));

      await service.analyzeTweets();

      // Should complete without throwing
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.findTweetsToClassify).toHaveBeenCalled();
    });

    it('should log correctly when processing single run with no more tweets', async () => {
      const singleBatch = Array.from({ length: 30 }, (_, i) => ({
        id: BigInt(i + 1),
        content: `Tweet ${i + 1}`,
      }));

      repository.findTweetsToClassify
        .mockReset()
        .mockResolvedValueOnce(singleBatch)
        .mockResolvedValue([]);

      await service.analyzeTweets();

      // Should process all tweets in one run
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(httpService.post).toHaveBeenCalledTimes(1);
    });

    it('should continue processing remaining batches after some updates fail', async () => {
      const mixedResultTweets: ClassifiedTweet[] = [
        { id: '1', class: 'technology' },
        { id: '2', class: 'sports' },
        { id: '3', class: 'entertainment' },
        { id: '4', class: 'news' },
        { id: '5', class: 'science' },
      ];

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const axiosResponse = {
        data: {
          batch_meta: { total_tweets: 5 },
          trending_keywords: [],
          tweets_detail: mixedResultTweets,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: undefined,
        },
      } as AxiosResponse<ModelApiResponse>;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      httpService.post.mockReset().mockReturnValue(of(axiosResponse));

      repository.findTweetsToClassify
        .mockReset()
        .mockResolvedValueOnce([
          { id: BigInt(1), content: 'Tweet 1' },
          { id: BigInt(2), content: 'Tweet 2' },
          { id: BigInt(3), content: 'Tweet 3' },
          { id: BigInt(4), content: 'Tweet 4' },
          { id: BigInt(5), content: 'Tweet 5' },
        ])
        .mockResolvedValue([]);

      repository.updateTweetClass
        .mockReset()
        .mockResolvedValueOnce(undefined) // Tweet 1 success
        .mockRejectedValueOnce(new Error('Database error')) // Tweet 2 fails
        .mockResolvedValueOnce(undefined) // Tweet 3 success
        .mockRejectedValueOnce(new Error('Database error')) // Tweet 4 fails
        .mockResolvedValueOnce(undefined); // Tweet 5 success

      await service.analyzeTweets();

      // Should attempt to update all 5 tweets despite failures
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.updateTweetClass).toHaveBeenCalledTimes(5);
    });

    it('should handle repository errors during tweet fetching', async () => {
      repository.findTweetsToClassify.mockReset().mockRejectedValue(new Error('Database error'));

      await service.analyzeTweets();

      // Should release lock even when error occurs
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(redisService.del).toHaveBeenCalled();
      // Should not call API
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should skip trending update when no keywords returned', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const noKeywordsResponse = {
        data: {
          batch_meta: { total_tweets: 3 },
          trending_keywords: null,
          tweets_detail: mockClassifiedTweets,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: undefined,
        },
      } as AxiosResponse<ModelApiResponse>;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      httpService.post.mockReset().mockReturnValue(of(noKeywordsResponse));

      await service.analyzeTweets();

      // Should not update trending when no keywords
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(trendingService.updateTrendScores).not.toHaveBeenCalled();
    });

    it('should handle trending service errors gracefully', async () => {
      trendingService.updateTrendScores.mockReset().mockRejectedValue(new Error('Trending error'));

      await expect(service.analyzeTweets()).resolves.not.toThrow();

      // Should still complete the job
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(redisService.del).toHaveBeenCalled();
    });

    it('should process tweets correctly when batch_meta is missing', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const noBatchMetaResponse = {
        data: {
          batch_meta: null,
          trending_keywords: mockTrendingKeywords,
          tweets_detail: mockClassifiedTweets,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: undefined,
        },
      } as AxiosResponse<ModelApiResponse>;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      httpService.post.mockReset().mockReturnValue(of(noBatchMetaResponse));

      await service.analyzeTweets();

      // Should still update trending with 0 total tweets
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(trendingService.updateTrendScores).toHaveBeenCalledWith({
        batch_meta: { total_tweets: 0 },
        trending_keywords: mockTrendingKeywords,
      });
    });
  });

  describe('lifecycle hooks', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start cron job on module init when enabled', () => {
      const analyzeSpy = jest.spyOn(service, 'analyzeTweets').mockResolvedValue(undefined);

      service.onModuleInit();

      // Should call immediately
      expect(analyzeSpy).toHaveBeenCalledTimes(1);

      // Advance time and check periodic execution
      jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes

      expect(analyzeSpy).toHaveBeenCalledTimes(2);

      analyzeSpy.mockRestore();
    });

    it('should not start cron job when disabled', () => {
      const disabledConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'CLASSIFY_TWEETS') return 'false';
          if (key === 'CLASSIFICATION_INTERVAL_MINUTES') return '5';
          if (key === 'CLASSIFY_REQ_LIMIT') return '50';
          if (key === 'CLASSIFICATION_API_URL') return 'http://localhost:5000/analyze';
          return '';
        }),
      } as unknown as ConfigService;

      const disabledService = new TweetAnalyzeService(
        disabledConfigService,
        httpService,
        repository,
        redisService,
        trendingService,
      );

      const analyzeSpy = jest.spyOn(disabledService, 'analyzeTweets').mockResolvedValue(undefined);

      disabledService.onModuleInit();

      expect(analyzeSpy).not.toHaveBeenCalled();

      jest.advanceTimersByTime(5 * 60 * 1000);

      expect(analyzeSpy).not.toHaveBeenCalled();

      analyzeSpy.mockRestore();
    });

    it('should handle errors in initial analysis run', () => {
      const analyzeSpy = jest
        .spyOn(service, 'analyzeTweets')
        .mockRejectedValue(new Error('Initial run failed'));

      service.onModuleInit();

      // Should not throw
      expect(() => service.onModuleInit()).not.toThrow();

      analyzeSpy.mockRestore();
    });

    it('should handle errors in scheduled analysis runs', () => {
      const analyzeSpy = jest
        .spyOn(service, 'analyzeTweets')
        .mockResolvedValueOnce(undefined) // First call succeeds
        .mockRejectedValue(new Error('Scheduled run failed')); // Subsequent calls fail

      service.onModuleInit();

      jest.advanceTimersByTime(5 * 60 * 1000);

      // Should not throw
      expect(() => jest.advanceTimersByTime(5 * 60 * 1000)).not.toThrow();

      analyzeSpy.mockRestore();
    });
  });
});
