/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { TrendingService } from '../../src/trending/trending.service';
import { TrendingRepository } from '../../src/trending/trending.repository';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Categories, Prisma } from '@prisma/client';
import { PlainHashtag } from '../../src/tweets/interfaces';
import { UpdateTrendScoresDto } from '../../src/trending/dtos';

describe('TrendingService', () => {
  let service: TrendingService;
  let repository: jest.Mocked<TrendingRepository>;

  beforeEach(async () => {
    const mockRepository = {
      createOrGetHashtags: jest.fn(),
      getHashtagId: jest.fn(),
      getTopWords: jest.fn(),
      scaleDownAllScores: jest.fn(),
      deleteOldKeywords: jest.fn(),
      deleteLowScoreCategories: jest.fn(),
      findKeywordByKeywordAndType: jest.fn(),
      createKeywordWithCategories: jest.fn(),
      upsertKeywordCategory: jest.fn(),
      updateKeyword: jest.fn(),
    };

    const mockPrisma: Partial<PrismaService> = {
      $transaction: jest.fn().mockImplementation((callback: unknown) => {
        if (typeof callback === 'function') {
          return Promise.resolve((callback as (tx: unknown) => unknown)(mockPrisma));
        }
        return Promise.resolve([]);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrendingService,
        { provide: TrendingRepository, useValue: mockRepository },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TrendingService>(TrendingService);
    repository = module.get(TrendingRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrGetHashtags', () => {
    it('should delegate to repository', async () => {
      const hashtags: PlainHashtag[] = [
        { keyword: 'test', startPosition: 0 },
        { keyword: 'hashtag', startPosition: 10 },
      ];
      const tx = {} as Prisma.TransactionClient;
      const expected = hashtags.map((h) => ({ ...h, hashtagId: BigInt(1) }));

      repository.createOrGetHashtags.mockResolvedValue(expected);

      const result = await service.createOrGetHashtags(hashtags, tx);

      expect(repository.createOrGetHashtags).toHaveBeenCalledWith(hashtags, tx);
      expect(result).toEqual(expected);
    });
  });

  describe('getHashtagId', () => {
    it('should return hashtag id if exists', async () => {
      const hashtag = 'test';
      const expected = { id: BigInt(123) };

      repository.getHashtagId.mockResolvedValue(expected);

      const result = await service.getHashtagId(hashtag);

      expect(repository.getHashtagId).toHaveBeenCalledWith(hashtag);
      expect(result).toEqual(expected);
    });

    it('should return null if hashtag does not exist', async () => {
      const hashtag = 'nonexistent';

      repository.getHashtagId.mockResolvedValue(null);

      const result = await service.getHashtagId(hashtag);

      expect(repository.getHashtagId).toHaveBeenCalledWith(hashtag);
      expect(result).toBeNull();
    });
  });

  describe('getTrendingWords', () => {
    it('should return empty array for empty query', async () => {
      const result = await service.getTrendingWords('', 10);

      expect(result).toEqual([]);
      expect(repository.getTopWords).not.toHaveBeenCalled();
    });

    it('should return empty array for whitespace-only query', async () => {
      const result = await service.getTrendingWords('   ', 10);

      expect(result).toEqual([]);
      expect(repository.getTopWords).not.toHaveBeenCalled();
    });

    it('should return empty array for query without alphanumeric characters', async () => {
      const result = await service.getTrendingWords('!!!', 10);

      expect(result).toEqual([]);
      expect(repository.getTopWords).not.toHaveBeenCalled();
    });

    it('should fetch and format trending words for regular query', async () => {
      const query = 'test';
      const limit = 5;
      const mockResults = [
        { keyword: 'testing', isHashtag: false },
        { keyword: 'testcase', isHashtag: false },
      ];

      repository.getTopWords.mockResolvedValue(mockResults);

      const result = await service.getTrendingWords(query, limit);

      expect(repository.getTopWords).toHaveBeenCalledWith('test', limit, false);
      expect(result).toEqual(['testing', 'testcase']);
    });

    it('should handle hashtag query by removing # and marking as hashtag', async () => {
      const query = '#trending';
      const limit = 10;
      const mockResults = [
        { keyword: 'trending', isHashtag: true },
        { keyword: 'trendingtoday', isHashtag: true },
      ];

      repository.getTopWords.mockResolvedValue(mockResults);

      const result = await service.getTrendingWords(query, limit);

      expect(repository.getTopWords).toHaveBeenCalledWith('trending', limit, true);
      expect(result).toEqual(['#trending', '#trendingtoday']);
    });

    it('should handle URL-encoded query', async () => {
      const query = 'test%20query';
      const limit = 5;
      const mockResults = [{ keyword: 'testquery', isHashtag: false }];

      repository.getTopWords.mockResolvedValue(mockResults);

      const result = await service.getTrendingWords(query, limit);

      expect(repository.getTopWords).toHaveBeenCalledWith('test query', limit, false);
      expect(result).toEqual(['testquery']);
    });

    it('should use original query if decoding fails', async () => {
      const query = '%E0%A4%A';
      const limit = 5;
      const mockResults: { keyword: string; isHashtag: boolean }[] = [];

      repository.getTopWords.mockResolvedValue(mockResults);

      const result = await service.getTrendingWords(query, limit);

      expect(repository.getTopWords).toHaveBeenCalledWith(query, limit, false);
      expect(result).toEqual([]);
    });
  });

  describe('updateTrendScores', () => {
    it('should process trend score updates successfully', async () => {
      const data: UpdateTrendScoresDto = {
        trending_keywords: [
          {
            keyword: '#test',
            top_related_topics: [{ topic: 'SPORTS', trend_score: 10, occurence_in_category: 5 }],
          },
        ],
        batch_meta: { total_tweets: 100 },
      };

      repository.scaleDownAllScores.mockResolvedValue(undefined);
      repository.findKeywordByKeywordAndType.mockResolvedValue(null);
      repository.createKeywordWithCategories.mockResolvedValue({
        id: BigInt(1),
        keyword: 'test',
        lastUpdatedAt: new Date(),
        isHashtag: true,
        count: 5,
        overallScore: 10,
        createdAt: new Date(),
      } as unknown as never);
      repository.deleteOldKeywords.mockResolvedValue(undefined);
      repository.deleteLowScoreCategories.mockResolvedValue(undefined);

      const result = await service.updateTrendScores(data);

      expect(result).toEqual({ message: 'Trend scores updated successfully' });
      expect(repository.scaleDownAllScores).toHaveBeenCalled();
      expect(repository.deleteOldKeywords).toHaveBeenCalled();
      expect(repository.deleteLowScoreCategories).toHaveBeenCalled();
    });

    it('should create new keyword when it does not exist', async () => {
      const data: UpdateTrendScoresDto = {
        trending_keywords: [
          {
            keyword: '#newkeyword',
            top_related_topics: [
              { topic: 'NEWS', trend_score: 20, occurence_in_category: 10 },
              { topic: 'SPORTS', trend_score: 15, occurence_in_category: 8 },
            ],
          },
        ],
        batch_meta: { total_tweets: 100 },
      };

      repository.scaleDownAllScores.mockResolvedValue(undefined);
      repository.findKeywordByKeywordAndType.mockResolvedValue(null);
      repository.createKeywordWithCategories.mockResolvedValue({
        id: BigInt(1),
        keyword: 'newkeyword',
        lastUpdatedAt: new Date(),
        isHashtag: true,
        count: 18,
        overallScore: 35,
        createdAt: new Date(),
      } as unknown as never);
      repository.deleteOldKeywords.mockResolvedValue(undefined);
      repository.deleteLowScoreCategories.mockResolvedValue(undefined);

      await service.updateTrendScores(data);

      const categoryScores: unknown = expect.arrayContaining([
        expect.objectContaining({
          category: Categories.NEWS,
          score: 20,
          categoryOccurenceCount: 10,
        }),
        expect.objectContaining({
          category: Categories.SPORTS,
          score: 15,
          categoryOccurenceCount: 8,
        }),
      ]);

      expect(repository.createKeywordWithCategories).toHaveBeenCalledWith(
        expect.objectContaining({
          keyword: 'newkeyword',
          isHashtag: true,
          overallScore: 35,
          count: 18,
          categoryScores,
        }),
        expect.any(Object),
      );
    });

    it('should update existing keyword with new scores', async () => {
      const data: UpdateTrendScoresDto = {
        trending_keywords: [
          {
            keyword: 'existing',
            top_related_topics: [{ topic: 'NEWS', trend_score: 10, occurence_in_category: 5 }],
          },
        ],
        batch_meta: { total_tweets: 100 },
      };

      const existingKeyword = {
        id: BigInt(1),
        keyword: 'existing',
        isHashtag: false,
        overallScore: 30,
        count: 20,
        lastUpdatedAt: new Date(),
        createdAt: new Date(),
        categoryScores: [
          {
            id: BigInt(1),
            trendingKeywordId: BigInt(1),
            category: Categories.NEWS,
            score: 30,
            categoryOccurenceCount: 15,
          },
        ],
      };

      repository.scaleDownAllScores.mockResolvedValue(undefined);
      repository.findKeywordByKeywordAndType.mockResolvedValue(existingKeyword);
      repository.upsertKeywordCategory.mockResolvedValue({
        id: BigInt(1),
        trendingKeywordId: BigInt(1),
        category: Categories.NEWS,
        score: 40,
        categoryOccurenceCount: 20,
      } as unknown as never);
      repository.updateKeyword.mockResolvedValue(existingKeyword as unknown as never);
      repository.deleteOldKeywords.mockResolvedValue(undefined);
      repository.deleteLowScoreCategories.mockResolvedValue(undefined);

      await service.updateTrendScores(data);

      expect(repository.upsertKeywordCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          trendingKeywordId: BigInt(1),
          category: Categories.NEWS,
          score: 40,
          categoryOccurenceCount: 20,
        }),
        expect.any(Object),
      );

      expect(repository.updateKeyword).toHaveBeenCalledWith(
        BigInt(1),
        expect.objectContaining({
          overallScore: 40,
          count: 25,
        }),
        expect.any(Object),
      );
    });

    it('should handle multiple categories for existing keyword', async () => {
      const data: UpdateTrendScoresDto = {
        trending_keywords: [
          {
            keyword: 'multi',
            top_related_topics: [
              { topic: 'SPORTS', trend_score: 5, occurence_in_category: 3 },
              { topic: 'ENTERTAINMENT', trend_score: 8, occurence_in_category: 4 },
            ],
          },
        ],
        batch_meta: { total_tweets: 100 },
      };

      const existingKeyword = {
        id: BigInt(2),
        keyword: 'multi',
        isHashtag: false,
        overallScore: 10,
        count: 10,
        lastUpdatedAt: new Date(),
        createdAt: new Date(),
        categoryScores: [
          {
            id: BigInt(1),
            trendingKeywordId: BigInt(2),
            category: Categories.SPORTS,
            score: 10,
            categoryOccurenceCount: 5,
          },
        ],
      };

      repository.scaleDownAllScores.mockResolvedValue(undefined);
      repository.findKeywordByKeywordAndType.mockResolvedValue(existingKeyword);
      repository.upsertKeywordCategory.mockResolvedValue({
        id: BigInt(1),
        trendingKeywordId: BigInt(2),
        category: Categories.SPORTS,
        score: 15,
        categoryOccurenceCount: 8,
      } as unknown as never);
      repository.updateKeyword.mockResolvedValue(existingKeyword as unknown as never);
      repository.deleteOldKeywords.mockResolvedValue(undefined);
      repository.deleteLowScoreCategories.mockResolvedValue(undefined);

      await service.updateTrendScores(data);

      expect(repository.upsertKeywordCategory).toHaveBeenCalledTimes(2);
      expect(repository.upsertKeywordCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          category: Categories.SPORTS,
          score: 15,
          categoryOccurenceCount: 8,
        }),
        expect.any(Object),
      );
      expect(repository.upsertKeywordCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          category: Categories.ENTERTAINMENT,
          score: 8,
          categoryOccurenceCount: 4,
        }),
        expect.any(Object),
      );
    });

    it('should normalize hashtag keywords to lowercase', async () => {
      const data: UpdateTrendScoresDto = {
        trending_keywords: [
          {
            keyword: '#TeSt',
            top_related_topics: [{ topic: 'NEWS', trend_score: 10, occurence_in_category: 5 }],
          },
        ],
        batch_meta: { total_tweets: 100 },
      };

      repository.scaleDownAllScores.mockResolvedValue(undefined);
      repository.findKeywordByKeywordAndType.mockResolvedValue(null);
      repository.createKeywordWithCategories.mockResolvedValue({
        id: BigInt(1),
        keyword: 'test',
        lastUpdatedAt: new Date(),
        isHashtag: true,
        count: 5,
        overallScore: 10,
        createdAt: new Date(),
      } as unknown as never);
      repository.deleteOldKeywords.mockResolvedValue(undefined);
      repository.deleteLowScoreCategories.mockResolvedValue(undefined);

      await service.updateTrendScores(data);

      expect(repository.findKeywordByKeywordAndType).toHaveBeenCalledWith(
        'test',
        true,
        expect.any(Object),
      );
      expect(repository.createKeywordWithCategories).toHaveBeenCalledWith(
        expect.objectContaining({
          keyword: 'test',
          isHashtag: true,
        }),
        expect.any(Object),
      );
    });

    it('should handle non-hashtag keywords', async () => {
      const data: UpdateTrendScoresDto = {
        trending_keywords: [
          {
            keyword: 'regular',
            top_related_topics: [{ topic: 'NEWS', trend_score: 5, occurence_in_category: 2 }],
          },
        ],
        batch_meta: { total_tweets: 100 },
      };

      repository.scaleDownAllScores.mockResolvedValue(undefined);
      repository.findKeywordByKeywordAndType.mockResolvedValue(null);
      repository.createKeywordWithCategories.mockResolvedValue({
        id: BigInt(1),
        keyword: 'regular',
        lastUpdatedAt: new Date(),
        isHashtag: false,
        count: 2,
        overallScore: 5,
        createdAt: new Date(),
      } as unknown as never);
      repository.deleteOldKeywords.mockResolvedValue(undefined);
      repository.deleteLowScoreCategories.mockResolvedValue(undefined);

      await service.updateTrendScores(data);

      expect(repository.createKeywordWithCategories).toHaveBeenCalledWith(
        expect.objectContaining({
          keyword: 'regular',
          isHashtag: false,
        }),
        expect.any(Object),
      );
    });
  });
});
