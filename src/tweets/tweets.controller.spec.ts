import { Test, TestingModule } from '@nestjs/testing';
import { TweetsController } from './tweets.controller';
import { TweetsService } from './tweets.service';

describe('TweetsController', () => {
  let controller: TweetsController;
  let mockTweetsService: Partial<TweetsService>;

  beforeEach(async () => {
    mockTweetsService = {
      getTimeline: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TweetsController],
      providers: [
        {
          provide: TweetsService,
          useValue: mockTweetsService,
        },
      ],
    }).compile();

    controller = module.get<TweetsController>(TweetsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
