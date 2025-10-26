import { Test, TestingModule } from '@nestjs/testing';
import { AuthModule } from './auth.module';

// const mockConfigService = {
//   get: jest.fn((key: string) => {
//     if (key === 'JWT_SECRET') return 'test-secret';
//     return null;
//   }),
// };

describe('AuthModule', () => {
  let authModule: AuthModule;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthModule],
    }).compile();

    authModule = module.get<AuthModule>(AuthModule);
  });

  it('should be defined', () => {
    expect(authModule).toBeDefined();
  });
});
