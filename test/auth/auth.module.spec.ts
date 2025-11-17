import { Test, TestingModule } from '@nestjs/testing';
import { AuthModule } from 'src/auth/auth.module';

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
