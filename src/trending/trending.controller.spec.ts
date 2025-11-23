import { Test, TestingModule } from '@nestjs/testing';
import { TrendingController } from './trending.controller';

describe('TrendingController', () => {
  let controller: TrendingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrendingController],
    }).compile();

    controller = module.get<TrendingController>(TrendingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
