import { Test, TestingModule } from '@nestjs/testing';
import { TimelineService } from './timeline.service';

describe('TimelineService', () => {
  let service: TimelineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TimelineService],
    }).compile();

    service = module.get<TimelineService>(TimelineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
