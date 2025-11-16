import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { RefreshTokensService } from './refresh-tokens.service';
import { RefreshTokensRepository } from './refresh-tokens.repository'; // The primary dependency to mock.
import { PrismaService } from 'src/prisma/prisma.service';
import { RefreshToken } from './interfaces';

describe('RefreshTokensService', () => {
  let service: RefreshTokensService;
  let mockRefreshTokensRepository: Partial<RefreshTokensRepository>;

  beforeEach(async () => {
    mockRefreshTokensRepository = {
      createRefreshToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokensService,
        { provide: RefreshTokensRepository, useValue: mockRefreshTokensRepository },
        { provide: PrismaService, useValue: {} },
        Logger,
      ],
    }).compile();

    service = module.get<RefreshTokensService>(RefreshTokensService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRefreshToken', () => {
    it('should correctly call the repository with token data and return the created token', async () => {
      const tokenData: RefreshToken = {
        userId: BigInt(123),
        deviceId: BigInt(456),
        tokenHash: 'a-very-secure-token-hash',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expires in 7 days
      };

      const expectedCreatedToken = {
        id: BigInt(1), // A new ID from the database
        user_id: tokenData.userId,
        device_id: tokenData.deviceId,
        token_hash: tokenData.tokenHash,
        expires_at: tokenData.expiresAt,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (mockRefreshTokensRepository.createRefreshToken as jest.Mock).mockResolvedValue(
        expectedCreatedToken,
      );

      const result = await service.createRefreshToken(tokenData, {} as never);

      expect(mockRefreshTokensRepository.createRefreshToken).toHaveBeenCalledWith(
        tokenData,
        {} as never,
      );
      expect(result).toBe(expectedCreatedToken);
    });
  });
});
