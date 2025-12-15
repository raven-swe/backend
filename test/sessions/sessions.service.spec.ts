import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { SessionsService } from 'src/sessions/sessions.service';
import { SessionsRepository } from 'src/sessions/sessions.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { Session } from 'src/sessions/interfaces/session.interface';
import { Prisma } from '@prisma/client';

describe('SessionsService', () => {
  let service: SessionsService;
  let repository: jest.Mocked<SessionsRepository>;
  let prismaService: PrismaService;

  const mockRepository = {
    createSession: jest.fn(),
    deleteSessionById: jest.fn(),
  };

  const mockPrismaService = {} as PrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Suppress logger output
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: SessionsRepository, useValue: mockRepository },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
    repository = module.get(SessionsRepository);
    prismaService = module.get(PrismaService);
  });

  describe('createSession', () => {
    it('should create a session and return it', async () => {
      const sessionData: Session = {
        userId: BigInt(1),
        deviceId: BigInt(100),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        deviceType: 'DESKTOP',
      };

      const createdSession = {
        id: BigInt(1),
        userId: BigInt(1),
        deviceId: BigInt(100),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        deviceType: 'DESKTOP',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.createSession.mockResolvedValue(createdSession);

      const result = await service.createSession(sessionData);

      expect(repository.createSession).toHaveBeenCalledWith(sessionData, prismaService);
      expect(result).toEqual(createdSession);
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Session created successfully for user ID: ' + sessionData.userId,
      );
    });

    it('should create a session with custom transaction client', async () => {
      const sessionData: Session = {
        userId: BigInt(2),
        deviceId: BigInt(200),
        ipAddress: '10.0.0.1',
        userAgent: 'Chrome/120.0',
        deviceType: 'MOBILE',
      };

      const mockTx = {} as Prisma.TransactionClient;

      const createdSession = {
        id: BigInt(2),
        userId: BigInt(2),
        deviceId: BigInt(200),
        ipAddress: '10.0.0.1',
        userAgent: 'Chrome/120.0',
        deviceType: 'MOBILE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.createSession.mockResolvedValue(createdSession);

      const result = await service.createSession(sessionData, mockTx);

      expect(repository.createSession).toHaveBeenCalledWith(sessionData, mockTx);
      expect(result).toEqual(createdSession);
    });

    it('should create session with different device types', async () => {
      const deviceTypes = ['DESKTOP', 'MOBILE', 'TABLET', 'OTHER'] as const;

      for (const deviceType of deviceTypes) {
        const sessionData: Session = {
          userId: BigInt(1),
          deviceId: BigInt(100),
          ipAddress: '192.168.1.1',
          userAgent: 'test-agent',
          deviceType,
        };

        const createdSession = {
          id: BigInt(1),
          ...sessionData,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockRepository.createSession.mockResolvedValue(createdSession);

        const result = await service.createSession(sessionData);

        expect(result.deviceType).toBe(deviceType);
      }
    });

    it('should handle session creation with IPv6 address', async () => {
      const sessionData: Session = {
        userId: BigInt(1),
        deviceId: BigInt(100),
        ipAddress: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
        userAgent: 'Mozilla/5.0',
        deviceType: 'DESKTOP',
      };

      const createdSession = {
        id: BigInt(1),
        ...sessionData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.createSession.mockResolvedValue(createdSession);

      const result = await service.createSession(sessionData);

      expect(result.ipAddress).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
    });

    it('should handle session creation with long user agent', async () => {
      const longUserAgent = 'A'.repeat(500);
      const sessionData: Session = {
        userId: BigInt(1),
        deviceId: BigInt(100),
        ipAddress: '192.168.1.1',
        userAgent: longUserAgent,
        deviceType: 'DESKTOP',
      };

      const createdSession = {
        id: BigInt(1),
        ...sessionData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.createSession.mockResolvedValue(createdSession);

      const result = await service.createSession(sessionData);

      expect(result.userAgent).toBe(longUserAgent);
    });

    it('should propagate repository errors', async () => {
      const sessionData: Session = {
        userId: BigInt(1),
        deviceId: BigInt(100),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        deviceType: 'DESKTOP',
      };

      const error = new Error('Database connection failed');
      mockRepository.createSession.mockRejectedValue(error);

      await expect(service.createSession(sessionData)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('deleteSessionById', () => {
    it('should delete a session by id', async () => {
      const sessionId = BigInt(1);

      mockRepository.deleteSessionById.mockResolvedValue(undefined);

      await service.deleteSessionById(sessionId);

      expect(repository.deleteSessionById).toHaveBeenCalledWith(sessionId, prismaService);
    });

    it('should delete a session with custom transaction client', async () => {
      const sessionId = BigInt(2);
      const mockTx = {} as Prisma.TransactionClient;

      mockRepository.deleteSessionById.mockResolvedValue(undefined);

      await service.deleteSessionById(sessionId, mockTx);

      expect(repository.deleteSessionById).toHaveBeenCalledWith(sessionId, mockTx);
    });

    it('should handle deletion of non-existent session', async () => {
      const sessionId = BigInt(999);

      mockRepository.deleteSessionById.mockResolvedValue(undefined);

      await expect(service.deleteSessionById(sessionId)).resolves.toBeUndefined();
    });

    it('should propagate repository errors during deletion', async () => {
      const sessionId = BigInt(1);
      const error = new Error('Foreign key constraint failed');

      mockRepository.deleteSessionById.mockRejectedValue(error);

      await expect(service.deleteSessionById(sessionId)).rejects.toThrow(
        'Foreign key constraint failed',
      );
    });

    it('should handle deletion with large session id', async () => {
      const sessionId = BigInt('9007199254740991'); // Max safe integer as BigInt

      mockRepository.deleteSessionById.mockResolvedValue(undefined);

      await service.deleteSessionById(sessionId);

      expect(repository.deleteSessionById).toHaveBeenCalledWith(sessionId, prismaService);
    });
  });

  describe('transaction handling', () => {
    it('should use provided transaction client for both operations', async () => {
      const mockTx = {} as Prisma.TransactionClient;
      const sessionData: Session = {
        userId: BigInt(1),
        deviceId: BigInt(100),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        deviceType: 'DESKTOP',
      };

      const createdSession = {
        id: BigInt(1),
        ...sessionData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.createSession.mockResolvedValue(createdSession);
      mockRepository.deleteSessionById.mockResolvedValue(undefined);

      // Create session with transaction
      await service.createSession(sessionData, mockTx);
      expect(repository.createSession).toHaveBeenCalledWith(sessionData, mockTx);

      // Delete session with transaction
      await service.deleteSessionById(BigInt(1), mockTx);
      expect(repository.deleteSessionById).toHaveBeenCalledWith(BigInt(1), mockTx);
    });

    it('should default to prisma service when no transaction provided', async () => {
      const sessionData: Session = {
        userId: BigInt(1),
        deviceId: BigInt(100),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        deviceType: 'DESKTOP',
      };

      const createdSession = {
        id: BigInt(1),
        ...sessionData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.createSession.mockResolvedValue(createdSession);
      mockRepository.deleteSessionById.mockResolvedValue(undefined);

      // Create session without transaction
      await service.createSession(sessionData);
      expect(repository.createSession).toHaveBeenCalledWith(sessionData, prismaService);

      // Delete session without transaction
      await service.deleteSessionById(BigInt(1));
      expect(repository.deleteSessionById).toHaveBeenCalledWith(BigInt(1), prismaService);
    });
  });
});
