import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from 'src/auth/guards';
import { OPTIONAL_AUTH_KEY } from 'src/common/decorators/optional-auth.decorator';
import { RequestUser } from 'src/common/interfaces';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    const mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtAuthGuard, { provide: Reflector, useValue: mockReflector }],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    reflector = module.get(Reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should call super.canActivate', () => {
      const mockContext = {
        switchToHttp: jest.fn(),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;

      const superCanActivateSpy = jest
        .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      const result = guard.canActivate(mockContext);

      expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);
      expect(result).toBe(true);

      superCanActivateSpy.mockRestore();
    });
  });

  describe('handleRequest', () => {
    let mockContext: ExecutionContext;

    beforeEach(() => {
      mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn(),
      } as unknown as ExecutionContext;
    });

    it('should return user when user is authenticated', () => {
      const mockUser: RequestUser = {
        id: BigInt(1),
        email: 'test@example.com',
        username: 'testuser',
      };

      reflector.getAllAndOverride.mockReturnValue(false);

      const result = guard.handleRequest(null, mockUser, null, mockContext);

      expect(result).toEqual(mockUser);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(OPTIONAL_AUTH_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
    });

    it('should return null when user is not authenticated and auth is optional', () => {
      reflector.getAllAndOverride.mockReturnValue(true);

      const result = guard.handleRequest(null, null, null, mockContext);

      expect(result).toBeNull();
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(OPTIONAL_AUTH_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
    });

    it('should throw UnauthorizedException when user is not authenticated and auth is required', () => {
      reflector.getAllAndOverride.mockReturnValue(false);

      expect(() => guard.handleRequest(null, null, null, mockContext)).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw error when error is provided and user is null', () => {
      const customError = new Error('Custom auth error');
      reflector.getAllAndOverride.mockReturnValue(false);

      expect(() => guard.handleRequest(customError, null, null, mockContext)).toThrow(
        'Custom auth error',
      );
    });

    it('should return user even when auth is optional and user exists', () => {
      const mockUser: RequestUser = {
        id: BigInt(2),
        email: 'optional@example.com',
        username: 'optionaluser',
      };

      reflector.getAllAndOverride.mockReturnValue(true);

      const result = guard.handleRequest(null, mockUser, null, mockContext);

      expect(result).toEqual(mockUser);
    });

    it('should handle user with all properties', () => {
      const mockUser: RequestUser = {
        id: BigInt(1),
        email: 'complete@example.com',
        username: 'completeuser',
      };

      reflector.getAllAndOverride.mockReturnValue(false);

      const result = guard.handleRequest(null, mockUser, null, mockContext);

      expect(result).toEqual(mockUser);
      expect(result.id).toBe(BigInt(1));
      expect(result.email).toBe('complete@example.com');
      expect(result.username).toBe('completeuser');
    });

    it('should prioritize error over UnauthorizedException', () => {
      const customError = new Error('Token expired');
      reflector.getAllAndOverride.mockReturnValue(false);

      expect(() => guard.handleRequest(customError, null, null, mockContext)).toThrow(
        'Token expired',
      );
    });

    it('should check both handler and class for optional auth decorator', () => {
      const mockHandler = jest.fn();
      const mockClass = jest.fn();

      mockContext = {
        getHandler: jest.fn().mockReturnValue(mockHandler),
        getClass: jest.fn().mockReturnValue(mockClass),
        switchToHttp: jest.fn(),
      } as unknown as ExecutionContext;

      reflector.getAllAndOverride.mockReturnValue(true);

      guard.handleRequest(null, null, null, mockContext);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(OPTIONAL_AUTH_KEY, [
        mockHandler,
        mockClass,
      ]);
    });

    it('should handle bigint user id correctly', () => {
      const mockUser: RequestUser = {
        id: BigInt('9007199254740991'), // Large BigInt
        email: 'bigint@example.com',
        username: 'bigintuser',
      };

      reflector.getAllAndOverride.mockReturnValue(false);

      const result = guard.handleRequest(null, mockUser, null, mockContext);

      expect(result.id).toBe(BigInt('9007199254740991'));
      expect(typeof result.id).toBe('bigint');
    });
  });
});
