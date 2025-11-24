import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { WsJwtGuard } from 'src/auth/guards/ws-jwt.guard';
import { AuthService } from 'src/auth/auth.service';
import { Socket } from 'socket.io';
import { WsUser } from 'src/auth/interfaces';

describe('WsJwtGuard', () => {
  let guard: WsJwtGuard;

  const mockAuthService = {
    validateUserToken: jest.fn(),
  };

  const createMockSocket = (
    token?: string,
    existingUser?: WsUser,
    connectedAt?: number,
  ): Partial<Socket> => {
    return {
      handshake: {
        query: token ? { token } : {},
      } as Socket['handshake'],
      data: {
        user: existingUser,
        connectedAt,
      },
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
  };

  const createMockContext = (socket: Partial<Socket>): ExecutionContext => {
    return {
      switchToWs: () => ({
        getClient: () => socket,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WsJwtGuard,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    guard = module.get<WsJwtGuard>(WsJwtGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    describe('when user is already authenticated', () => {
      it('should return true if user exists and connection is not expired', async () => {
        const mockUser: WsUser = {
          id: '1',
          username: 'testuser',
          displayName: 'Test User',
          avatarUrl: 'https://example.com/avatar.jpg',
        };
        const recentConnectionTime = Date.now() - 60000;
        const mockSocket = createMockSocket(undefined, mockUser, recentConnectionTime);
        const mockContext = createMockContext(mockSocket);

        const result = await guard.canActivate(mockContext);

        expect(result).toBe(true);
        expect(mockAuthService.validateUserToken).not.toHaveBeenCalled();
        expect(mockSocket.emit).not.toHaveBeenCalled();
        expect(mockSocket.disconnect).not.toHaveBeenCalled();
      });

      it('should disconnect and return false if connection has expired (>2 hours)', async () => {
        const mockUser: WsUser = {
          id: '1',
          username: 'testuser',
          displayName: 'Test User',
          avatarUrl: 'https://example.com/avatar.jpg',
        };
        const expiredConnectionTime = Date.now() - 3 * 60 * 60 * 1000;
        const mockSocket = createMockSocket(undefined, mockUser, expiredConnectionTime);
        const mockContext = createMockContext(mockSocket);

        const result = await guard.canActivate(mockContext);

        expect(result).toBe(false);
        expect(mockSocket.emit).toHaveBeenCalledWith('error', {
          type: 'authentication_error',
          code: 'SESSION_EXPIRED',
          message: 'Connection session expired after 2 hours. Please reconnect.',
        });
        expect(mockSocket.disconnect).toHaveBeenCalled();
        expect(mockAuthService.validateUserToken).not.toHaveBeenCalled();
      });
    });

    describe('when authenticating for the first time', () => {
      it('should return false and emit error if no token is provided', async () => {
        const mockSocket = createMockSocket();
        const mockContext = createMockContext(mockSocket);

        const result = await guard.canActivate(mockContext);

        expect(result).toBe(false);
        expect(mockSocket.emit).toHaveBeenCalledWith('error', {
          type: 'authentication_error',
          code: 'MISSING_TOKEN',
          message: 'Authentication token is required.',
        });
        expect(mockSocket.disconnect).toHaveBeenCalled();
        expect(mockAuthService.validateUserToken).not.toHaveBeenCalled();
      });

      it('should return false and emit error if token is invalid', async () => {
        const mockSocket = createMockSocket('invalid-token');
        const mockContext = createMockContext(mockSocket);

        mockAuthService.validateUserToken.mockResolvedValue(null);

        const result = await guard.canActivate(mockContext);

        expect(result).toBe(false);
        expect(mockAuthService.validateUserToken).toHaveBeenCalledWith('invalid-token');
        expect(mockSocket.emit).toHaveBeenCalledWith('error', {
          type: 'authentication_error',
          code: 'INVALID_TOKEN',
          message: 'Authentication failed. Invalid or expired token.',
        });
        expect(mockSocket.disconnect).toHaveBeenCalled();
      });

      it('should return true and store user data if token is valid', async () => {
        const mockSocket = createMockSocket('valid-token');
        const mockContext = createMockContext(mockSocket);

        const mockValidatedUser = {
          id: BigInt(123),
          username: 'testuser',
          displayName: 'Test User',
          avatarUrl: 'https://example.com/avatar.jpg',
        };

        mockAuthService.validateUserToken.mockResolvedValue(mockValidatedUser);

        const result = await guard.canActivate(mockContext);

        expect(result).toBe(true);
        expect(mockAuthService.validateUserToken).toHaveBeenCalledWith('valid-token');
        const socketData = mockSocket.data as { user: WsUser; connectedAt: number };
        expect(socketData.user).toEqual({
          id: '123',
          username: 'testuser',
          displayName: 'Test User',
          avatarUrl: 'https://example.com/avatar.jpg',
        });
        expect(socketData.connectedAt).toBeDefined();
        expect(socketData.connectedAt).toBeGreaterThan(Date.now() - 1000);
        expect(mockSocket.emit).not.toHaveBeenCalled();
        expect(mockSocket.disconnect).not.toHaveBeenCalled();
      });

      it('should return true and store user data with null avatarUrl', async () => {
        const mockSocket = createMockSocket('valid-token');
        const mockContext = createMockContext(mockSocket);

        const mockValidatedUser = {
          id: BigInt(456),
          username: 'anotheruser',
          displayName: 'Another User',
          avatarUrl: null,
        };

        mockAuthService.validateUserToken.mockResolvedValue(mockValidatedUser);

        const result = await guard.canActivate(mockContext);

        expect(result).toBe(true);
        const socketData = mockSocket.data as { user: WsUser };
        expect(socketData.user).toEqual({
          id: '456',
          username: 'anotheruser',
          displayName: 'Another User',
          avatarUrl: null,
        });
      });
    });

    describe('edge cases', () => {
      it('should authenticate if user exists but connectedAt is missing', async () => {
        const mockUser: WsUser = {
          id: '1',
          username: 'testuser',
          displayName: 'Test User',
          avatarUrl: 'https://example.com/avatar.jpg',
        };
        const mockSocket = createMockSocket('new-token', mockUser, undefined);
        const mockContext = createMockContext(mockSocket);

        const mockValidatedUser = {
          id: BigInt(1),
          username: 'testuser',
          displayName: 'Test User',
          avatarUrl: 'https://example.com/avatar.jpg',
        };

        mockAuthService.validateUserToken.mockResolvedValue(mockValidatedUser);

        const result = await guard.canActivate(mockContext);

        expect(result).toBe(true);
        expect(mockAuthService.validateUserToken).toHaveBeenCalledWith('new-token');
      });

      it('should authenticate if connectedAt exists but user is missing', async () => {
        const recentConnectionTime = Date.now() - 60000;
        const mockSocket = createMockSocket('new-token', undefined, recentConnectionTime);
        const mockContext = createMockContext(mockSocket);

        const mockValidatedUser = {
          id: BigInt(2),
          username: 'testuser2',
          displayName: 'Test User 2',
          avatarUrl: 'https://example.com/avatar.jpg',
        };

        mockAuthService.validateUserToken.mockResolvedValue(mockValidatedUser);

        const result = await guard.canActivate(mockContext);

        expect(result).toBe(true);
        expect(mockAuthService.validateUserToken).toHaveBeenCalledWith('new-token');
      });
    });
  });
});
