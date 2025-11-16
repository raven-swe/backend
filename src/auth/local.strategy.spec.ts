import { Test, TestingModule } from '@nestjs/testing';
import { LocalStrategy } from './local.strategy';
import { AuthService } from '../auth/auth.service';
import { UnauthorizedException } from '@nestjs/common';
import { RequestUser } from '../common/interfaces';

const mockAuthService = {
  validateUser: jest.fn(),
};

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    strategy = module.get<LocalStrategy>(LocalStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return the user if validation is successful', async () => {
      const mockUser: RequestUser = { id: '1' };
      const username = 'test';
      const password = 'password';

      mockAuthService.validateUser.mockResolvedValue(mockUser);

      const result = await strategy.validate(username, password);

      expect(mockAuthService.validateUser).toHaveBeenCalledWith(username, password);
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException if validation fails', async () => {
      const username = 'test';
      const password = 'wrongpassword';

      mockAuthService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate(username, password)).rejects.toThrow(UnauthorizedException);

      expect(mockAuthService.validateUser).toHaveBeenCalledWith(username, password);
    });
  });
});
