import { Test, TestingModule } from '@nestjs/testing';
import { TweetsService } from './tweets.service';
import { TweetsRepository } from './tweets.repository';
import { PrismaService } from 'src/prisma/prisma.service';

describe('TweetsService', () => {
  let service: TweetsService;
  let mockTweetsRepository: Partial<TweetsRepository>;

  beforeEach(async () => {
    mockTweetsRepository = {
      getTimelineForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TweetsService,
        {
          provide: TweetsRepository,
          useValue: mockTweetsRepository,
        },
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<TweetsService>(TweetsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
