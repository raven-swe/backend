import { Test, TestingModule } from '@nestjs/testing';
import { OAuthService } from '../oauth.service';
import { OAuthRepository } from '../oauth.repository';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from '../auth.service';

describe('OAuthService', () => {
  let service: OAuthService;

  const mockOAuthRepository = {
    findExternalAccountWithUser: jest.fn(),
    findUserByEmail: jest.fn(),
    findUserByEmailWithExternalAccounts: jest.fn(),
    createExternalAccount: jest.fn(),
    createUserWithProfileAndExternalAccount: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockAuthService = {
    login: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthService,
        {
          provide: OAuthRepository,
          useValue: mockOAuthRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    service = module.get<OAuthService>(OAuthService);

    mockConfigService.get.mockReturnValue('30');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleOauthToken', () => {
    const mockDeviceType = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
    const mockIpAddress = '127.0.0.1';
    const mockClientType = 'web';
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
        service.handleOauthToken(
          'facebook' as any,
          'token-123',
          mockDeviceType,
          mockIpAddress,
          mockClientType,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle GitHub provider token validation', async () => {
      const mockStrategy = {
        validateToken: jest.fn().mockResolvedValue(mockProviderProfile),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      (service as any).strategies.github = mockStrategy;

      mockOAuthRepository.findExternalAccountWithUser.mockResolvedValue({
        user: {
          id: BigInt(1),
          username: 'testuser',
          email: 'test@example.com',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      mockAuthService.login.mockResolvedValue({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });

      const result = await service.handleOauthToken(
        'github',
        'token-123',
        mockDeviceType,
        mockIpAddress,
        mockClientType,
      );

      expect(mockStrategy.validateToken).toHaveBeenCalledWith('token-123', mockClientType);
      expect(mockStrategy.validateToken).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should handle Google provider token validation', async () => {
      const googleProfile = { ...mockProviderProfile, provider: 'google' };
      const mockStrategy = {
        validateToken: jest.fn().mockResolvedValue(googleProfile),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      (service as any).strategies.google = mockStrategy;

      mockOAuthRepository.findExternalAccountWithUser.mockResolvedValue({
        user: {
          id: BigInt(1),
          username: 'testuser',
          email: 'test@example.com',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      mockAuthService.login.mockResolvedValue({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });

      const result = await service.handleOauthToken(
        'google',
        'token-123',
        mockDeviceType,
        mockIpAddress,
        mockClientType,
      );

      expect(mockStrategy.validateToken).toHaveBeenCalledWith('token-123', mockClientType);
      expect(mockStrategy.validateToken).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('handleOauthProfile', () => {
    const mockDeviceType = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
    const mockIpAddress = '127.0.0.1';
    const mockProviderProfile = {
      id: 'github-123',
      email: 'test@example.com',
      name: 'Test User',
      avatar_url: 'https://avatar.url',
      provider: 'github',
    };

    it('should login existing user with external account (Already existing external Account)', async () => {
      mockOAuthRepository.findExternalAccountWithUser.mockResolvedValue({
        user: {
          id: BigInt(1),
          username: 'existinguser',
          email: 'test@example.com',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      mockAuthService.login.mockResolvedValue({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });

      const result = await service.handleOauthProfile(
        mockProviderProfile,
        mockDeviceType,
        mockIpAddress,
      );

      expect(mockOAuthRepository.findExternalAccountWithUser).toHaveBeenCalledWith(
        'github',
        'github-123',
      );
      expect(mockAuthService.login).toHaveBeenCalledWith(
        { id: '1' },
        mockDeviceType,
        mockIpAddress,
      );
      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });
    });

    it('should link external account to existing user by email (not existing external Account)', async () => {
      mockOAuthRepository.findExternalAccountWithUser.mockResolvedValue(null);
      mockOAuthRepository.findUserByEmail.mockResolvedValue({
        id: BigInt(1),
        username: 'existinguser',
        email: 'test@example.com',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockOAuthRepository.createExternalAccount.mockResolvedValue({} as any);

      mockAuthService.login.mockResolvedValue({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });

      const result = await service.handleOauthProfile(
        mockProviderProfile,
        mockDeviceType,
        mockIpAddress,
      );

      expect(mockOAuthRepository.findUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockOAuthRepository.createExternalAccount).toHaveBeenCalledWith(
        BigInt(1),
        'github',
        'github-123',
      );
      expect(mockAuthService.login).toHaveBeenCalledWith(
        { id: '1', username: 'existinguser' },
        mockDeviceType,
        mockIpAddress,
      );
      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });
    });

    it('should return creation token for new user', async () => {
      mockOAuthRepository.findExternalAccountWithUser.mockResolvedValue(null);
      mockOAuthRepository.findUserByEmail.mockResolvedValue(null);
      mockJwtService.sign.mockReturnValue('mock-creation-token');

      const result = await service.handleOauthProfile(
        mockProviderProfile,
        mockDeviceType,
        mockIpAddress,
      );

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        provider: 'github',
        providerId: 'github-123',
        email: 'test@example.com',
        name: 'Test User',
        type: 'creation',
        avatar_url: 'https://avatar.url',
      });
      expect(result).toEqual({
        creationToken: 'mock-creation-token',
      });
    });
  });

  describe('completeOauthRegister', () => {
    const mockDeviceType = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
    const mockIpAddress = '127.0.0.1';
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
      mockOAuthRepository.findUserByEmailWithExternalAccounts.mockResolvedValue(null);
      mockOAuthRepository.createUserWithProfileAndExternalAccount.mockResolvedValue({
        id: BigInt(1),
        username: 'newuser@example.com',
        email: 'newuser@example.com',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      mockAuthService.login.mockResolvedValue({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });

      const result = await service.completeOauthRegister(
        mockCreationToken,
        mockBirthDate,
        mockDeviceType,
        mockIpAddress,
      );

      expect(mockJwtService.verify).toHaveBeenCalledWith(mockCreationToken);
      expect(mockJwtService.verify).toHaveBeenCalledTimes(1);
      expect(mockAuthService.login).toHaveBeenCalledWith(
        { id: '1' },
        mockDeviceType,
        mockIpAddress,
      );
      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });
    });

    it('should throw BadRequestException for expired token', async () => {
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';

      mockJwtService.verify.mockImplementation(() => {
        throw expiredError;
      });

      try {
        await service.completeOauthRegister(
          'expired-token',
          mockBirthDate,
          mockDeviceType,
          mockIpAddress,
        );
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
      }
    });

    it('should create user with correct data', async () => {
      mockJwtService.verify.mockReturnValue(mockPayload);
      mockOAuthRepository.findUserByEmailWithExternalAccounts.mockResolvedValue(null);
      mockOAuthRepository.createUserWithProfileAndExternalAccount.mockResolvedValue({
        id: BigInt(1),
        username: 'new',
        email: 'newuser@example.com',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      mockAuthService.login.mockResolvedValue({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });

      await service.completeOauthRegister(
        mockCreationToken,
        mockBirthDate,
        mockDeviceType,
        mockIpAddress,
      );

      expect(mockOAuthRepository.createUserWithProfileAndExternalAccount).toHaveBeenCalledWith(
        'newuser@example.com',
        'new',
        new Date(mockBirthDate),
        'New User',
        'https://avatar.url',
        'github',
        'github-123',
      );
      expect(mockOAuthRepository.createUserWithProfileAndExternalAccount).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(
        service.completeOauthRegister(
          'invalid-token',
          mockBirthDate,
          mockDeviceType,
          mockIpAddress,
        ),
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
        service.completeOauthRegister(
          mockCreationToken,
          mockBirthDate,
          mockDeviceType,
          mockIpAddress,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockJwtService.verify).toHaveBeenCalledWith(mockCreationToken);
      expect(mockJwtService.verify).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException for expired token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Token expired');
      });

      await expect(
        service.completeOauthRegister(
          'expired-token',
          mockBirthDate,
          mockDeviceType,
          mockIpAddress,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should parse birthdate correctly', async () => {
      mockJwtService.verify.mockReturnValue(mockPayload);
      mockOAuthRepository.findUserByEmailWithExternalAccounts.mockResolvedValue(null);
      mockOAuthRepository.createUserWithProfileAndExternalAccount.mockResolvedValue({
        id: BigInt(1),
        username: 'newuser@example.com',
        email: 'newuser@example.com',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      mockAuthService.login.mockResolvedValue({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });

      await service.completeOauthRegister(
        mockCreationToken,
        '1995-06-15',
        mockDeviceType,
        mockIpAddress,
      );

      const createCall = mockOAuthRepository.createUserWithProfileAndExternalAccount.mock
        .calls[0] as unknown[];
      expect(createCall[2]).toEqual(new Date('1995-06-15'));
    });
  });
});
