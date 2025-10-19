import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { Logger } from '@nestjs/common';

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisService, Logger],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });
  afterAll(async () =>{
    await service.onModuleDestroy();
  })
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
