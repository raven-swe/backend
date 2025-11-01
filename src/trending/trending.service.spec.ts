import { Test, TestingModule } from '@nestjs/testing';
import { TrendingService } from './trending.service';

describe('TrendingService', () => {
  let service: TrendingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrendingService],
    }).compile();

    service = module.get<TrendingService>(TrendingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
