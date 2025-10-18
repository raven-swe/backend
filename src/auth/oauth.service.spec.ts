import { Test, TestingModule } from '@nestjs/testing';
import { oAuthService } from './oauth.service';

describe('AuthService', () => {
  let service: oAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [oAuthService],
    }).compile();

    service = module.get<oAuthService>(oAuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
