import { Test, TestingModule } from '@nestjs/testing';
import { TrendingService } from './trending.service';
import { TrendingRepository } from './trending.repository';

describe('TrendingService', () => {
  let service: TrendingService;

  const mockTrendingRepository = {
    getOrCreateHashtagIds: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrendingService,
        {
          provide: TrendingRepository,
          useValue: mockTrendingRepository,
        },
      ],
    }).compile();

    service = module.get<TrendingService>(TrendingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
