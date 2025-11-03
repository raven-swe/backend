import { Test, TestingModule } from '@nestjs/testing';
import { OauthController } from '../oauth.controller';
import { OAuthService } from '../oauth.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import type { Response } from 'express';

describe('OauthController', () => {
  let controller: OauthController;

  const mockOAuthService = {
    handleOauthToken: jest.fn(),
    completeOauthRegister: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'NODE_ENV') return 'development';
      if (key === 'REFRESH_TOKEN_EXPIRES_IN_DAYS') return 30;
      return undefined;
    }),
  };

  const createMockResponse = (): Partial<Response> => ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OauthController],
      providers: [
        {
          provide: OAuthService,
          useValue: mockOAuthService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<OauthController>(OauthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('providerCallback', () => {
    const mockDeviceType = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
    const mockIpAddress = '127.0.0.1';
    const mockOauthCallbackDto = {
      providerToken: 'mock-token-123',
    };

    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should successfully handle GitHub OAuth callback for existing user (web client)', async () => {
      const mockResponse = createMockResponse();
      const mockLoginResponse = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      };

      mockOAuthService.handleOauthToken.mockResolvedValue(mockLoginResponse);

      const result = await controller.providerCallback(
        'github',
        mockOauthCallbackDto,
        mockIpAddress,
        mockDeviceType,
        mockResponse as Response,
        'web',
      );

      expect(result).toEqual({ accessToken: 'mock-access-token' });
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'mock-refresh-token',
        expect.objectContaining({
          httpOnly: true,
          secure: false, // development mode
          sameSite: 'none',
        }),
      );
      expect(mockOAuthService.handleOauthToken).toHaveBeenCalledWith(
        'github',
        'mock-token-123',
        mockDeviceType,
        mockIpAddress,
        'web',
      );
      expect(mockOAuthService.handleOauthToken).toHaveBeenCalledTimes(1);
    });

    it('should successfully handle GitHub OAuth callback for existing user (mobile client)', async () => {
      const mockResponse = createMockResponse();
      const mockLoginResponse = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      };

      mockOAuthService.handleOauthToken.mockResolvedValue(mockLoginResponse);

      const result = await controller.providerCallback(
        'github',
        mockOauthCallbackDto,
        mockIpAddress,
        mockDeviceType,
        mockResponse as Response,
        'mobile',
      );

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });
      expect(mockResponse.cookie).not.toHaveBeenCalled();
      expect(mockOAuthService.handleOauthToken).toHaveBeenCalledTimes(1);
    });

    it('should return creation token for new user', async () => {
      const mockResponse = createMockResponse();
      const mockCreationResponse = {
        creationToken: 'mock-creation-token-abc123',
      };

      mockOAuthService.handleOauthToken.mockResolvedValue(mockCreationResponse);

      const result = await controller.providerCallback(
        'github',
        mockOauthCallbackDto,
        mockIpAddress,
        mockDeviceType,
        mockResponse as Response,
        'web',
      );

      expect(result).toEqual({ creationToken: 'mock-creation-token-abc123' });
      expect(mockResponse.cookie).not.toHaveBeenCalled();
      expect(mockOAuthService.handleOauthToken).toHaveBeenCalledTimes(1);
    });

    it('should successfully handle Google OAuth callback', async () => {
      const mockResponse = createMockResponse();
      const mockLoginResponse = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      };

      mockOAuthService.handleOauthToken.mockResolvedValue(mockLoginResponse);

      const result = await controller.providerCallback(
        'google',
        mockOauthCallbackDto,
        mockIpAddress,
        mockDeviceType,
        mockResponse as Response,
        'mobile',
      );

      expect(result).toEqual(mockLoginResponse);
      expect(mockOAuthService.handleOauthToken).toHaveBeenCalledWith(
        'google',
        'mock-token-123',
        mockDeviceType,
        mockIpAddress,
        'mobile',
      );
      expect(mockOAuthService.handleOauthToken).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException for unsupported provider', async () => {
      const mockResponse = createMockResponse();

      await expect(
        controller.providerCallback(
          'facebook',
          mockOauthCallbackDto,
          mockIpAddress,
          mockDeviceType,
          mockResponse as Response,
          'web',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockOAuthService.handleOauthToken).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty provider', async () => {
      const mockResponse = createMockResponse();

      await expect(
        controller.providerCallback(
          '',
          mockOauthCallbackDto,
          mockIpAddress,
          mockDeviceType,
          mockResponse as Response,
          'web',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockOAuthService.handleOauthToken).not.toHaveBeenCalled();
    });

    it('should throw BadReq when clientType header is missing', async () => {
      const mockResponse = createMockResponse();
      const mockLoginResponse = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      };

      mockOAuthService.handleOauthToken.mockResolvedValue(mockLoginResponse);

      await expect(
        controller.providerCallback(
          'github',
          mockOauthCallbackDto,
          mockIpAddress,
          mockDeviceType,
          mockResponse as Response,
          null as unknown as 'web',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle service errors gracefully', async () => {
      const mockResponse = createMockResponse();
      mockOAuthService.handleOauthToken.mockRejectedValue(new Error('OAuth provider error'));

      await expect(
        controller.providerCallback(
          'github',
          mockOauthCallbackDto,
          mockIpAddress,
          mockDeviceType,
          mockResponse as Response,
          'web',
        ),
      ).rejects.toThrow('OAuth provider error');
      expect(mockOAuthService.handleOauthToken).toHaveBeenCalledTimes(1);
    });
  });

  describe('completeOauthRegister', () => {
    const mockIpAddress = '192.168.1.1';
    const mockDeviceType = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
    const mockOauthCompleteDto = {
      creationToken: 'mock-creation-token',
      birthDate: '2005-01-10',
    };

    it('should successfully complete OAuth registration (web client)', async () => {
      const mockResponse = createMockResponse();
      const mockLoginResponse = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      };

      mockOAuthService.completeOauthRegister.mockResolvedValue(mockLoginResponse);

      const result = await controller.completeOauthRegister(
        mockIpAddress,
        mockDeviceType,
        mockResponse as Response,
        mockOauthCompleteDto,
        'web',
      );

      expect(result).toEqual({ accessToken: 'mock-access-token' });
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'mock-refresh-token',
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'none',
        }),
      );
      expect(mockOAuthService.completeOauthRegister).toHaveBeenCalledWith(
        'mock-creation-token',
        '2005-01-10',
        mockDeviceType,
        mockIpAddress,
      );
      expect(mockOAuthService.completeOauthRegister).toHaveBeenCalledTimes(1);
    });

    it('should successfully complete OAuth registration (mobile client)', async () => {
      const mockResponse = createMockResponse();
      const mockLoginResponse = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      };

      mockOAuthService.completeOauthRegister.mockResolvedValue(mockLoginResponse);

      const result = await controller.completeOauthRegister(
        mockIpAddress,
        mockDeviceType,
        mockResponse as Response,
        mockOauthCompleteDto,
        'mobile',
      );

      expect(result).toEqual(mockLoginResponse);
      expect(mockResponse.cookie).not.toHaveBeenCalled();
      expect(mockOAuthService.completeOauthRegister).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid creation token', async () => {
      const mockResponse = createMockResponse();
      mockOAuthService.completeOauthRegister.mockRejectedValue(
        new BadRequestException('Invalid creation token'),
      );

      await expect(
        controller.completeOauthRegister(
          mockIpAddress,
          mockDeviceType,
          mockResponse as Response,
          { creationToken: 'invalid-token', birthDate: '1990-01-01' },
          'web',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockOAuthService.completeOauthRegister).toHaveBeenCalledTimes(1);
    });

    // should reject users under 13 years old
    it('should handle underage birthdate', async () => {
      const mockResponse = createMockResponse();
      mockOAuthService.completeOauthRegister.mockRejectedValue(
        new BadRequestException('User must be at least 13 years old'),
      );

      await expect(
        controller.completeOauthRegister(
          mockIpAddress,
          mockDeviceType,
          mockResponse as Response,
          { creationToken: 'valid-token', birthDate: '2015-05-20' },
          'web',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockOAuthService.completeOauthRegister).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid birthdate format', async () => {
      const mockResponse = createMockResponse();
      mockOAuthService.completeOauthRegister.mockRejectedValue(
        new BadRequestException('Invalid birth date'),
      );

      await expect(
        controller.completeOauthRegister(
          mockIpAddress,
          mockDeviceType,
          mockResponse as Response,
          { creationToken: 'valid-token', birthDate: 'invalid-date' },
          'web',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockOAuthService.completeOauthRegister).toHaveBeenCalledTimes(1);
    });

    it('should handle service errors during completion', async () => {
      const mockResponse = createMockResponse();
      mockOAuthService.completeOauthRegister.mockRejectedValue(new Error('Database error'));

      await expect(
        controller.completeOauthRegister(
          mockIpAddress,
          mockDeviceType,
          mockResponse as Response,
          mockOauthCompleteDto,
          'web',
        ),
      ).rejects.toThrow('Database error');
      expect(mockOAuthService.completeOauthRegister).toHaveBeenCalledTimes(1);
    });

    it('should pass all parameters correctly to service', async () => {
      const mockResponse = createMockResponse();
      mockOAuthService.completeOauthRegister.mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh',
      });

      await controller.completeOauthRegister(
        mockIpAddress,
        mockDeviceType,
        mockResponse as Response,
        {
          creationToken: 'specific-token-123',
          birthDate: '1995-06-15',
        },
        'mobile',
      );

      expect(mockOAuthService.completeOauthRegister).toHaveBeenCalledWith(
        'specific-token-123',
        '1995-06-15',
        mockDeviceType,
        mockIpAddress,
      );
      expect(mockOAuthService.completeOauthRegister).toHaveBeenCalledTimes(1);
    });
  });

  describe('getProviderBridge', () => {
    const mockState = Buffer.from(
      JSON.stringify({ redirect: 'https://app.example.com/oauth' }),
    ).toString('base64');

    it('should return redirect URL with code parameter', () => {
      const query = { code: 'auth-code-123', state: mockState };
      const result = controller.getProviderBridge('github', query);

      expect(result).toEqual({
        url: 'https://app.example.com/oauth?provider=github&code=auth-code-123',
      });
    });

    it('should return redirect URL with error parameters', () => {
      const query = {
        error: 'access_denied',
        errorDescription: 'User denied access',
        state: mockState,
      };
      const result = controller.getProviderBridge('google', query);

      expect(result).toEqual({
        url: 'https://app.example.com/oauth?provider=google&error=access_denied&errorDescription=User+denied+access',
      });
    });

    it('should throw BadRequestException for unsupported provider', () => {
      const query = { code: 'code-123', state: mockState };
      expect(() => controller.getProviderBridge('facebook', query)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for missing state', () => {
      const query = { code: 'code-123', state: '' };
      expect(() => controller.getProviderBridge('github', query)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid state', () => {
      const query = { code: 'code-123', state: 'invalid-base64' };
      expect(() => controller.getProviderBridge('google', query)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for missing redirect in state', () => {
      const invalidState = Buffer.from(JSON.stringify({})).toString('base64');
      const query = { code: 'code-123', state: invalidState };
      expect(() => controller.getProviderBridge('github', query)).toThrow(BadRequestException);
    });
  });
});
