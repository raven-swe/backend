import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { RequestUser } from './types';
import { UsersService } from 'src/users/users.service';
import { JwtPayload } from './types/jwt-payload.type';
import { HttpException } from '@nestjs/common';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_SECRET') return 'test-secret';
      return null;
    }),
  };
  const mockUsersService: jest.Mocked<Partial<UsersService>> = {
    checkIfUserExistsAndActive: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return the user payload from the JWT', async () => {
      const payload: JwtPayload = { id: '1' };
      const user: Partial<RequestUser> = { id: BigInt(payload.id) };

      (mockUsersService.checkIfUserExistsAndActive as jest.Mock).mockResolvedValueOnce(
        user as RequestUser,
      );

      const result = await strategy.validate(payload);

      expect(result).toEqual(user);
    });

    it('should return the user payload from the JWT', async () => {
      const payload: JwtPayload = { id: '1' };

      (mockUsersService.checkIfUserExistsAndActive as jest.Mock).mockResolvedValueOnce(null);

      await expect(strategy.validate(payload)).rejects.toThrow(HttpException);
    });
  });
});
