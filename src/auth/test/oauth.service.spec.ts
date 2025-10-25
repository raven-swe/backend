import { Test, TestingModule } from '@nestjs/testing';
import { oAuthService } from '../oauth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import * as useragent from 'useragent';
import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';

// Mock external modules
jest.mock('bcrypt');
jest.mock('node:crypto');

describe('oAuthService', () => {
  let service: oAuthService;
  let prismaService: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockPrismaService = {
    user_external_accounts: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    users: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user_devices: {
      create: jest.fn(),
    },
    refresh_tokens: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        oAuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<oAuthService>(oAuthService);
    prismaService = module.get(PrismaService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);

    mockConfigService.get.mockReturnValue('30'); // sets default refresh token expiry to 30 days
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleOauthToken', () => {
    const mockAgent = useragent.parse('Mozilla/5.0');
    const mockProviderProfile = {
      id: 'github-123',
      email: 'test@example.com',
      name: 'Test User',
      avatar_url: 'https://avatar.url',
      provider: 'github',
    };

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should throw BadRequestException for unsupported provider', async () => {
      await expect(
        service.handleOauthToken('facebook' as any, 'token-123', mockAgent),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle GitHub provider token validation', async () => {
      // Mock strategy validateToken
      const mockStrategy = {
        validateToken: jest.fn().mockResolvedValue(mockProviderProfile),
      };
      (service as any).strategies.github = mockStrategy;

      // Mock existing external account
      mockPrismaService.user_external_accounts.findUnique.mockResolvedValue({
        user: {
          id: BigInt(1),
          username: 'testuser',
          email: 'test@example.com',
        },
      } as any);

      // Mock login flow
      mockJwtService.sign.mockReturnValue('mock-access-token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');
      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue('mock-refresh-token'),
      });
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          user_devices: {
            create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
          },
          refresh_tokens: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await service.handleOauthToken('github', 'token-123', mockAgent);

      expect(mockStrategy.validateToken).toHaveBeenCalledWith('token-123');
      expect(mockStrategy.validateToken).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
    });

    it('should handle Google provider token validation', async () => {
      const googleProfile = { ...mockProviderProfile, provider: 'google' };
      const mockStrategy = {
        validateToken: jest.fn().mockResolvedValue(googleProfile),
      };
      (service as any).strategies.google = mockStrategy;

      mockPrismaService.user_external_accounts.findUnique.mockResolvedValue({
        user: {
          id: BigInt(1),
          username: 'testuser',
          email: 'test@example.com',
        },
      } as any);

      mockJwtService.sign.mockReturnValue('mock-access-token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');
      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue('mock-refresh-token'),
      });
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          user_devices: { create: jest.fn().mockResolvedValue({ id: BigInt(1) }) },
          refresh_tokens: { create: jest.fn().mockResolvedValue({}) },
        });
      });

      const result = await service.handleOauthToken('google', 'token-123', mockAgent);

      expect(mockStrategy.validateToken).toHaveBeenCalledWith('token-123');
      expect(mockStrategy.validateToken).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
    });
  });

  describe('handleOauthProfile', () => {
    const mockAgent = useragent.parse('Mozilla/5.0');
    const mockProviderProfile = {
      id: 'github-123',
      email: 'test@example.com',
      name: 'Test User',
      avatar_url: 'https://avatar.url',
      provider: 'github',
    };

    it('should login existing user with external account (Already existing external Account)', async () => {
      mockPrismaService.user_external_accounts.findUnique.mockResolvedValue({
        user: {
          id: BigInt(1),
          username: 'existinguser',
          email: 'test@example.com',
        },
      } as any);

      mockJwtService.sign.mockReturnValue('mock-access-token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');
      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue('mock-refresh-token'),
      });
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          user_devices: { create: jest.fn().mockResolvedValue({ id: BigInt(1) }) },
          refresh_tokens: { create: jest.fn().mockResolvedValue({}) },
        });
      });

      const result = await service.handleOauthProfile(mockProviderProfile, mockAgent);

      expect(mockPrismaService.user_external_accounts.findUnique).toHaveBeenCalledWith({
        where: {
          provider_provider_user_id: {
            provider: 'github',
            provider_user_id: 'github-123',
          },
        },
        include: { user: true },
      });
      expect(result).toEqual({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
      });
    });

    it('should link external account to existing user by email (not existing external Account)', async () => {
      mockPrismaService.user_external_accounts.findUnique.mockResolvedValue(null);
      mockPrismaService.users.findUnique.mockResolvedValue({
        id: BigInt(1),
        username: 'existinguser',
        email: 'test@example.com',
      } as any);
      mockPrismaService.user_external_accounts.create.mockResolvedValue({} as any);

      mockJwtService.sign.mockReturnValue('mock-access-token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');
      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue('mock-refresh-token'),
      });
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          user_devices: { create: jest.fn().mockResolvedValue({ id: BigInt(1) }) },
          refresh_tokens: { create: jest.fn().mockResolvedValue({}) },
        });
      });

      const result = await service.handleOauthProfile(mockProviderProfile, mockAgent);

      expect(mockPrismaService.users.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(mockPrismaService.user_external_accounts.create).toHaveBeenCalledWith({
        data: {
          user_id: BigInt(1),
          provider_user_id: 'github-123',
          provider: 'github',
        },
      });
      expect(result).toEqual({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
      });
    });

    it('should return creation token for new user', async () => {
      mockPrismaService.user_external_accounts.findUnique.mockResolvedValue(null);
      mockPrismaService.users.findUnique.mockResolvedValue(null);
      mockJwtService.sign.mockReturnValue('mock-creation-token');

      const result = await service.handleOauthProfile(mockProviderProfile, mockAgent);

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        provider: 'github',
        providerId: 'github-123',
        email: 'test@example.com',
        name: 'Test User',
        type: 'creation',
        avatar_url: 'https://avatar.url',
      });
      expect(result).toEqual({
        success: true,
        data: { creationToken: 'mock-creation-token' },
      });
    });
  });

  describe('login', () => {
    const mockAgent = useragent.parse('Mozilla/5.0');
    const mockUser = { id: '1', username: 'testuser' };

    beforeEach(() => {
      mockJwtService.sign.mockReturnValue('mock-access-token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');
      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue('mock-refresh-token-xyz'),
      });
    });

    it('should create user device record', async () => {
      const mockCreateDevice = jest.fn().mockResolvedValue({ id: BigInt(100) });
      const mockCreateRefreshToken = jest.fn().mockResolvedValue({});

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          user_devices: { create: mockCreateDevice },
          refresh_tokens: { create: mockCreateRefreshToken },
        });
      });

      await service.login(mockUser, mockAgent);

      expect(mockCreateDevice).toHaveBeenCalledWith({
        data: {
          user_id: BigInt(1),
          device_type: mockAgent.toString(),
        },
      });
      expect(mockCreateDevice).toHaveBeenCalledTimes(1);
    });

    it('should create refresh token with correct expiry', async () => {
      const mockCreateDevice = jest.fn().mockResolvedValue({ id: BigInt(100) });
      const mockCreateRefreshToken = jest.fn().mockResolvedValue({});

      mockConfigService.get.mockReturnValue('7'); // 7 days

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          user_devices: { create: mockCreateDevice },
          refresh_tokens: { create: mockCreateRefreshToken },
        });
      });

      await service.login(mockUser, mockAgent);

      expect(mockCreateRefreshToken).toHaveBeenCalledWith({
        data: {
          user_id: BigInt(1),
          device_id: BigInt(100),
          token_hash: 'hashed-refresh-token',
          expires_at: expect.any(Date),
        },
      });
      expect(mockCreateRefreshToken).toHaveBeenCalledTimes(1);
    });

    it('should hash refresh token before storing', async () => {
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          user_devices: { create: jest.fn().mockResolvedValue({ id: BigInt(100) }) },
          refresh_tokens: { create: jest.fn().mockResolvedValue({}) },
        });
      });

      await service.login(mockUser, mockAgent);

      expect(bcrypt.hash).toHaveBeenCalledWith('mock-refresh-token-xyz', 10);
      expect(bcrypt.hash).toHaveBeenCalledTimes(1);
    });
  });

  describe('completeOauthRegister', () => {
    const mockAgent = useragent.parse('Mozilla/5.0');
    const mockCreationToken = 'valid-creation-token';
    const mockBirthDate = '1990-01-01';

    const mockPayload = {
      provider: 'github',
      providerId: 'github-123',
      email: 'newuser@example.com',
      name: 'New User',
      type: 'creation',
      avatar_url: 'https://avatar.url',
    };

    it('should successfully complete registration', async () => {
      mockJwtService.verify.mockReturnValue(mockPayload);
      mockPrismaService.users.create.mockResolvedValue({
        id: BigInt(1),
        username: 'newuser@example.com',
        email: 'newuser@example.com',
      } as any);

      mockJwtService.sign.mockReturnValue('mock-access-token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');
      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue('mock-refresh-token'),
      });
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          user_devices: { create: jest.fn().mockResolvedValue({ id: BigInt(1) }) },
          refresh_tokens: { create: jest.fn().mockResolvedValue({}) },
        });
      });

      const result = await service.completeOauthRegister(
        mockCreationToken,
        mockBirthDate,
        mockAgent,
      );

      expect(mockJwtService.verify).toHaveBeenCalledWith(mockCreationToken);
      expect(mockJwtService.verify).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
      });
    });

    it('should create user with correct data', async () => {
      mockJwtService.verify.mockReturnValue(mockPayload);
      mockPrismaService.users.create.mockResolvedValue({
        id: BigInt(1),
        username: 'newuser@example.com',
        email: 'newuser@example.com',
      } as any);

      mockJwtService.sign.mockReturnValue('mock-access-token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');
      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue('mock-refresh-token'),
      });
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          user_devices: { create: jest.fn().mockResolvedValue({ id: BigInt(1) }) },
          refresh_tokens: { create: jest.fn().mockResolvedValue({}) },
        });
      });

      await service.completeOauthRegister(mockCreationToken, mockBirthDate, mockAgent);

      expect(mockPrismaService.users.create).toHaveBeenCalledWith({
        data: {
          email: 'newuser@example.com',
          username: 'newuser@example.com',
          birthdate: new Date(mockBirthDate),
          profile: {
            create: {
              display_name: 'New User',
              avatar_url: 'https://avatar.url',
            },
          },
          user_external_accounts: {
            create: {
              provider: 'github',
              provider_user_id: 'github-123',
            },
          },
        },
      });
      expect(mockPrismaService.users.create).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(
        service.completeOauthRegister('invalid-token', mockBirthDate, mockAgent),
      ).rejects.toThrow(BadRequestException);

      expect(mockJwtService.verify).toHaveBeenCalledWith('invalid-token');
      expect(mockJwtService.verify).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException for non-creation token type', async () => {
      mockJwtService.verify.mockReturnValue({
        ...mockPayload,
        type: 'access', // Wrong type
      });

      await expect(
        service.completeOauthRegister(mockCreationToken, mockBirthDate, mockAgent),
      ).rejects.toThrow(BadRequestException);

      expect(mockJwtService.verify).toHaveBeenCalledWith(mockCreationToken);
      expect(mockJwtService.verify).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException for expired token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Token expired');
      });

      await expect(
        service.completeOauthRegister('expired-token', mockBirthDate, mockAgent),
      ).rejects.toThrow(BadRequestException);
    });

    it('should parse birthdate correctly', async () => {
      mockJwtService.verify.mockReturnValue(mockPayload);
      mockPrismaService.users.create.mockResolvedValue({
        id: BigInt(1),
        username: 'newuser@example.com',
        email: 'newuser@example.com',
      } as any);

      mockJwtService.sign.mockReturnValue('mock-access-token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');
      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue('mock-refresh-token'),
      });
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          user_devices: { create: jest.fn().mockResolvedValue({ id: BigInt(1) }) },
          refresh_tokens: { create: jest.fn().mockResolvedValue({}) },
        });
      });

      await service.completeOauthRegister(mockCreationToken, '1995-06-15', mockAgent);

      const createCall = mockPrismaService.users.create.mock.calls[0][0];
      expect(createCall.data.birthdate).toEqual(new Date('1995-06-15'));
    });
  });

  describe('Edge Cases', () => {
    const mockAgent = useragent.parse('Mozilla/5.0');

    it('should handle database transaction failure during login', async () => {
      mockJwtService.sign.mockReturnValue('mock-access-token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');
      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue('mock-refresh-token'),
      });

      mockPrismaService.$transaction.mockRejectedValue(new Error('Database error'));

      const mockUser = { id: '1', username: 'testuser' };

      await expect(service.login(mockUser, mockAgent)).rejects.toThrow('Database error');
    });

    it('should handle user creation failure', async () => {
      mockJwtService.verify.mockReturnValue({
        provider: 'github',
        providerId: 'github-123',
        email: 'test@example.com',
        name: 'Test User',
        type: 'creation',
        avatar_url: 'https://avatar.url',
      });

      mockPrismaService.users.create.mockRejectedValue(new Error('Email already exists'));

      await expect(service.completeOauthRegister('token', '1990-01-01', mockAgent)).rejects.toThrow(
        'Email already exists',
      );
    });
  });
});
