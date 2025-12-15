/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { RefreshTokensService } from 'src/refresh-tokens/refresh-tokens.service';
import { RefreshTokensRepository } from 'src/refresh-tokens/refresh-tokens.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { RefreshToken } from 'src/refresh-tokens/interfaces';
import { Prisma } from '@prisma/client';

describe('RefreshTokensService', () => {
  let service: RefreshTokensService;
  let repository: jest.Mocked<RefreshTokensRepository>;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const mockRepository = {
      createRefreshToken: jest.fn(),
      getTokenByHash: jest.fn(),
      updateTokenHash: jest.fn(),
      deleteTokensById: jest.fn(),
    };

    const mockPrismaService = {} as PrismaService;

    // Suppress logger output
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokensService,
        { provide: RefreshTokensRepository, useValue: mockRepository },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<RefreshTokensService>(RefreshTokensService);
    repository = module.get(RefreshTokensRepository);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('hashStringDeterministic', () => {
    it('should hash a string deterministically', () => {
      const input = 'test-token-string';
      const hash1 = service.hashStringDeterministic(input);
      const hash2 = service.hashStringDeterministic(input);

      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBe(64); // SHA-256 produces 64 hex characters
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = service.hashStringDeterministic('token1');
      const hash2 = service.hashStringDeterministic('token2');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = service.hashStringDeterministic('');

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    it('should handle special characters', () => {
      const input = 'token!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      const hash = service.hashStringDeterministic(input);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    it('should handle unicode characters', () => {
      const input = '🔒🔑 secure-token-αβγδ';
      const hash = service.hashStringDeterministic(input);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    it('should produce hex output', () => {
      const hash = service.hashStringDeterministic('test');
      const isHex = /^[0-9a-f]+$/.test(hash);

      expect(isHex).toBe(true);
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      const hash = service.hashStringDeterministic(longString);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });
  });

  describe('createRefreshToken', () => {
    it('should correctly call the repository with token data and return the created token', async () => {
      const tokenData: RefreshToken = {
        userId: BigInt(123),
        sessionId: BigInt(456),
        tokenHash: 'a-very-secure-token-hash',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const expectedCreatedToken = {
        id: BigInt(1),
        userId: tokenData.userId,
        sessionId: tokenData.sessionId,
        tokenHash: tokenData.tokenHash,
        expiresAt: tokenData.expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.createRefreshToken.mockResolvedValue(expectedCreatedToken as any);

      const result = await service.createRefreshToken(tokenData);

      expect(repository.createRefreshToken).toHaveBeenCalledWith(tokenData, prismaService);
      expect(result).toBe(expectedCreatedToken);
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Refresh token created successfully for user ID: ' + tokenData.userId,
      );
    });

    it('should create token with custom transaction client', async () => {
      const tokenData: RefreshToken = {
        userId: BigInt(1),
        sessionId: BigInt(2),
        tokenHash: 'hash123',
        expiresAt: new Date(),
      };

      const mockTx = {} as Prisma.TransactionClient;
      const expectedToken = {
        id: BigInt(1),
        ...tokenData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.createRefreshToken.mockResolvedValue(expectedToken as any);

      const result = await service.createRefreshToken(tokenData, mockTx);

      expect(repository.createRefreshToken).toHaveBeenCalledWith(tokenData, mockTx);
      expect(result).toEqual(expectedToken);
    });

    it('should handle token with far future expiration', async () => {
      const tokenData: RefreshToken = {
        userId: BigInt(1),
        sessionId: BigInt(2),
        tokenHash: 'hash123',
        expiresAt: new Date('2099-12-31'),
      };

      const expectedToken = {
        id: BigInt(1),
        ...tokenData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.createRefreshToken.mockResolvedValue(expectedToken as any);

      const result = await service.createRefreshToken(tokenData);

      expect(result.expiresAt).toEqual(new Date('2099-12-31'));
    });

    it('should propagate repository errors', async () => {
      const tokenData: RefreshToken = {
        userId: BigInt(1),
        sessionId: BigInt(2),
        tokenHash: 'hash123',
        expiresAt: new Date(),
      };

      const error = new Error('Database error');
      repository.createRefreshToken.mockRejectedValue(error);

      await expect(service.createRefreshToken(tokenData)).rejects.toThrow('Database error');
    });
  });

  describe('getTokenByHash', () => {
    it('should get token by hash', async () => {
      const hash = 'test-hash-123';
      const expectedToken = {
        id: BigInt(1),
        userId: BigInt(100),
        sessionId: BigInt(200),
        tokenHash: hash,
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: BigInt(100),
          username: 'testuser',
        },
      };

      repository.getTokenByHash.mockResolvedValue(expectedToken as any);

      const result = await service.getTokenByHash(hash);

      expect(repository.getTokenByHash).toHaveBeenCalledWith(hash);
      expect(result).toEqual(expectedToken);
    });

    it('should return null when token not found', async () => {
      const hash = 'non-existent-hash';

      repository.getTokenByHash.mockResolvedValue(null);

      const result = await service.getTokenByHash(hash);

      expect(result).toBeNull();
    });

    it('should handle long hash strings', async () => {
      const longHash = 'a'.repeat(1000);

      repository.getTokenByHash.mockResolvedValue(null);

      await service.getTokenByHash(longHash);

      expect(repository.getTokenByHash).toHaveBeenCalledWith(longHash);
    });

    it('should propagate repository errors', async () => {
      const hash = 'test-hash';
      const error = new Error('Connection timeout');

      repository.getTokenByHash.mockRejectedValue(error);

      await expect(service.getTokenByHash(hash)).rejects.toThrow('Connection timeout');
    });
  });

  describe('updateTokenHash', () => {
    it('should update token hash with new values', async () => {
      const tokenId = BigInt(1);
      const newHash = 'new-hash-value';
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const updatedToken = {
        id: tokenId,
        userId: BigInt(100),
        sessionId: BigInt(200),
        tokenHash: newHash,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.updateTokenHash.mockResolvedValue(updatedToken as any);

      const result = await service.updateTokenHash(tokenId, newHash, expiresAt);

      expect(repository.updateTokenHash).toHaveBeenCalledWith(tokenId, newHash, expiresAt);
      expect(result).toEqual(updatedToken);
    });

    it('should handle update with past expiration date', async () => {
      const tokenId = BigInt(1);
      const newHash = 'expired-hash';
      const expiresAt = new Date('2020-01-01');

      const updatedToken = {
        id: tokenId,
        userId: BigInt(100),
        sessionId: BigInt(200),
        tokenHash: newHash,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.updateTokenHash.mockResolvedValue(updatedToken as any);

      const result = await service.updateTokenHash(tokenId, newHash, expiresAt);

      expect(result.expiresAt).toEqual(expiresAt);
    });

    it('should propagate repository errors during update', async () => {
      const tokenId = BigInt(1);
      const newHash = 'new-hash';
      const expiresAt = new Date();
      const error = new Error('Update failed');

      repository.updateTokenHash.mockRejectedValue(error);

      await expect(service.updateTokenHash(tokenId, newHash, expiresAt)).rejects.toThrow(
        'Update failed',
      );
    });
  });

  describe('deleteTokensById', () => {
    it('should delete token by id', async () => {
      const tokenId = BigInt(1);

      repository.deleteTokensById.mockResolvedValue({ count: 1 } as any);

      await service.deleteTokensById(tokenId);

      expect(repository.deleteTokensById).toHaveBeenCalledWith(tokenId, prismaService);
    });

    it('should delete token with custom transaction client', async () => {
      const tokenId = BigInt(2);
      const mockTx = {} as Prisma.TransactionClient;

      repository.deleteTokensById.mockResolvedValue({ count: 1 } as any);

      await service.deleteTokensById(tokenId, mockTx);

      expect(repository.deleteTokensById).toHaveBeenCalledWith(tokenId, mockTx);
    });

    it('should handle deletion of non-existent token', async () => {
      const tokenId = BigInt(999);

      repository.deleteTokensById.mockResolvedValue({ count: 0 } as any);

      await expect(service.deleteTokensById(tokenId)).resolves.toEqual({ count: 0 });
    });

    it('should propagate repository errors during deletion', async () => {
      const tokenId = BigInt(1);
      const error = new Error('Deletion failed');

      repository.deleteTokensById.mockRejectedValue(error);

      await expect(service.deleteTokensById(tokenId)).rejects.toThrow('Deletion failed');
    });

    it('should handle deletion with large token id', async () => {
      const tokenId = BigInt('9007199254740991');

      repository.deleteTokensById.mockResolvedValue({ count: 1 } as any);

      await service.deleteTokensById(tokenId);

      expect(repository.deleteTokensById).toHaveBeenCalledWith(tokenId, prismaService);
    });
  });

  describe('transaction handling', () => {
    it('should use default prisma service when no transaction provided', async () => {
      const tokenData: RefreshToken = {
        userId: BigInt(1),
        sessionId: BigInt(2),
        tokenHash: 'hash',
        expiresAt: new Date(),
      };

      const createdToken = {
        id: BigInt(1),
        ...tokenData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.createRefreshToken.mockResolvedValue(createdToken as any);
      repository.deleteTokensById.mockResolvedValue({ count: 1 } as any);

      await service.createRefreshToken(tokenData);
      expect(repository.createRefreshToken).toHaveBeenCalledWith(tokenData, prismaService);

      await service.deleteTokensById(BigInt(1));
      expect(repository.deleteTokensById).toHaveBeenCalledWith(BigInt(1), prismaService);
    });

    it('should use provided transaction client for operations', async () => {
      const mockTx = {} as Prisma.TransactionClient;
      const tokenData: RefreshToken = {
        userId: BigInt(1),
        sessionId: BigInt(2),
        tokenHash: 'hash',
        expiresAt: new Date(),
      };

      const createdToken = {
        id: BigInt(1),
        ...tokenData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.createRefreshToken.mockResolvedValue(createdToken as any);
      repository.deleteTokensById.mockResolvedValue({ count: 1 } as any);

      await service.createRefreshToken(tokenData, mockTx);
      expect(repository.createRefreshToken).toHaveBeenCalledWith(tokenData, mockTx);

      await service.deleteTokensById(BigInt(1), mockTx);
      expect(repository.deleteTokensById).toHaveBeenCalledWith(BigInt(1), mockTx);
    });
  });
});
