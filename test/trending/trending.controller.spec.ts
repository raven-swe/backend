import { Test, TestingModule } from '@nestjs/testing';
import { TrendingController } from '../../src/trending/trending.controller';
import { TrendingService } from '../../src/trending/trending.service';

describe('TrendingController', () => {
  let controller: TrendingController;

  const mockTrendingService = {
    updateTrendScores: jest.fn(),
    createOrIncrementHashtags: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrendingController],
      providers: [
        {
          provide: TrendingService,
          useValue: mockTrendingService,
        },
      ],
    }).compile();

    controller = module.get<TrendingController>(TrendingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
