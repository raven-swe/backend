import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { RequestUser } from './types';

// Mock the ConfigService
const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'JWT_SECRET') return 'test-secret';
    return null;
  }),
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return the user payload from the JWT', async () => {
      // Arrange
      const payload: RequestUser = { id: '1', username: 'testuser' };

      // Act
      const result = await strategy.validate(payload);

      // Assert
      // This strategy simply returns the payload it was given
      expect(result).toEqual(payload);
    });
  });
});
