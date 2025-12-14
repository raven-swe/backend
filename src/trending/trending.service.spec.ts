import { Test, TestingModule } from '@nestjs/testing';
import { TrendingService } from './trending.service';
import { TrendingRepository } from './trending.repository';
import { PrismaService } from 'src/prisma/prisma.service';

describe('TrendingService', () => {
  let service: TrendingService;

  const mockTrendingRepository = {
    createOrIncrementHashtags: jest.fn(),
    scaleDownAllScores: jest.fn(),
    findKeywordByKeywordAndType: jest.fn(),
    createKeywordWithCategories: jest.fn(),
    upsertKeywordCategory: jest.fn(),
    updateKeyword: jest.fn(),
    deleteOldKeywords: jest.fn(),
    deleteLowScoreCategories: jest.fn(),
    runInTransaction: jest.fn(),
  };

  const mockPrismaService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrendingService,
        {
          provide: TrendingRepository,
          useValue: mockTrendingRepository,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TrendingService>(TrendingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
