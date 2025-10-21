import { Test, TestingModule } from '@nestjs/testing';
import { OauthController } from '../oauth.controller';
import { oAuthService } from '../oauth.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import * as useragent from 'useragent';

describe('OauthController', () => {
  let controller: OauthController;

  const mockOAuthService = {
    handleOauthToken: jest.fn(),
    completeOauthRegister: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OauthController],
      providers: [
        {
          provide: oAuthService,
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
    const mockUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
    const mockOauthCallbackDto = {
      providerTokenId: 'mock-token-123',
    };

    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should successfully handle GitHub OAuth callback', async () => {
      const mockResponse = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
      };

      mockOAuthService.handleOauthToken.mockResolvedValue(mockResponse);

      const result = await controller.providerCallback(
        'github',
        mockOauthCallbackDto,
        mockUserAgent,
      );

      expect(result).toEqual(mockResponse);
      expect(mockOAuthService.handleOauthToken).toHaveBeenCalledWith(
        'github',
        'mock-token-123',
        expect.any(Object), // useragent parsed object
      );
      expect(mockOAuthService.handleOauthToken).toHaveBeenCalledTimes(1);
    });

    it('should successfully handle Google OAuth callback', async () => {
      const mockResponse = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
      };

      mockOAuthService.handleOauthToken.mockResolvedValue(mockResponse);

      const result = await controller.providerCallback(
        'google',
        mockOauthCallbackDto,
        mockUserAgent,
      );

      expect(result).toEqual(mockResponse);
      expect(mockOAuthService.handleOauthToken).toHaveBeenCalledWith(
        'google',
        'mock-token-123',
        expect.any(Object),
      );
      expect(mockOAuthService.handleOauthToken).toHaveBeenCalledTimes(1);
    });

    it('should return creation token for new user', async () => {
      const mockResponse = {
        success: true,
        data: { creationToken: 'mock-creation-token' },
      };

      mockOAuthService.handleOauthToken.mockResolvedValue(mockResponse);

      const result = await controller.providerCallback(
        'github',
        mockOauthCallbackDto,
        mockUserAgent,
      );

      expect(result).toEqual(mockResponse);
      expect(mockOAuthService.handleOauthToken).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException for unsupported provider', async () => {
      await expect(
        controller.providerCallback('facebook', mockOauthCallbackDto, mockUserAgent),
      ).rejects.toThrow(BadRequestException);

      expect(mockOAuthService.handleOauthToken).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty provider', async () => {
      await expect(
        controller.providerCallback('', mockOauthCallbackDto, mockUserAgent),
      ).rejects.toThrow(BadRequestException);

      expect(mockOAuthService.handleOauthToken).not.toHaveBeenCalled();
    });

    it('should parse user agent correctly', async () => {
      const customUserAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15';

      mockOAuthService.handleOauthToken.mockResolvedValue({
        access_token: 'token',
        refresh_token: 'refresh',
      });

      await controller.providerCallback('github', mockOauthCallbackDto, customUserAgent);

      const callArgs = mockOAuthService.handleOauthToken.mock.calls[0];
      const parsedAgent = callArgs[2];

      expect(parsedAgent).toBeInstanceOf(useragent.Agent);
      expect(mockOAuthService.handleOauthToken).toHaveBeenCalledTimes(1);
    });

    it('should handle service errors gracefully', async () => {
      mockOAuthService.handleOauthToken.mockRejectedValue(
        new Error('OAuth provider error'),
      );

      await expect(
        controller.providerCallback('github', mockOauthCallbackDto, mockUserAgent),
      ).rejects.toThrow('OAuth provider error');
      expect(mockOAuthService.handleOauthToken).toHaveBeenCalledTimes(1);
    });
  });


  describe('completeOauthRegister', () => {
    const mockUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
    const mockOauthCompleteDto = {
      creationToken: 'mock-creation-token',
      birthDate: '2005-01-10',
    };

    it('should successfully complete OAuth registration', async () => {
      const mockResponse = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
      };

      mockOAuthService.completeOauthRegister.mockResolvedValue(mockResponse);

      const result = await controller.completeOauthRegister(
        mockOauthCompleteDto,
        mockUserAgent,
      );

      expect(result).toEqual(mockResponse);
      expect(mockOAuthService.completeOauthRegister).toHaveBeenCalledWith(
        'mock-creation-token',
        '2005-01-10',
        expect.any(Object), // useragent parsed object
      );
      expect(mockOAuthService.completeOauthRegister).toHaveBeenCalledTimes(1);
    });

    it('should parse user agent when completing registration', async () => {
      const mobileUserAgent = 'Mozilla/5.0 (Linux; Android 10; SM-G973F)';

      mockOAuthService.completeOauthRegister.mockResolvedValue({
        access_token: 'token',
        refresh_token: 'refresh',
      });

      await controller.completeOauthRegister(mockOauthCompleteDto, mobileUserAgent);

      const callArgs = mockOAuthService.completeOauthRegister.mock.calls[0];
      const parsedAgent = callArgs[2];

      expect(parsedAgent).toBeInstanceOf(useragent.Agent);
      expect(mockOAuthService.completeOauthRegister).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid creation token', async () => {
      mockOAuthService.completeOauthRegister.mockRejectedValue(
        new BadRequestException('Invalid creation token'),
      );

      await expect(
        controller.completeOauthRegister(
          { creationToken: 'invalid-token', birthDate: '1990-01-01' },
          mockUserAgent,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockOAuthService.completeOauthRegister).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid birthdate format', async () => {
      mockOAuthService.completeOauthRegister.mockRejectedValue(
        new BadRequestException('Invalid birth date'),
      );

      await expect(
        controller.completeOauthRegister(
          { creationToken: 'valid-token', birthDate: 'invalid-date' },
          mockUserAgent,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockOAuthService.completeOauthRegister).toHaveBeenCalledTimes(1);
    });

    it('should handle service errors during completion', async () => {
      mockOAuthService.completeOauthRegister.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        controller.completeOauthRegister(mockOauthCompleteDto, mockUserAgent),
      ).rejects.toThrow('Database error');
      expect(mockOAuthService.completeOauthRegister).toHaveBeenCalledTimes(1);
    });

    it('should pass all parameters correctly to service', async () => {
      mockOAuthService.completeOauthRegister.mockResolvedValue({
        access_token: 'token',
        refresh_token: 'refresh',
      });

      await controller.completeOauthRegister(
        {
          creationToken: 'specific-token-123',
          birthDate: '1995-06-15',
        },
        mockUserAgent,
      );

      expect(mockOAuthService.completeOauthRegister).toHaveBeenCalledWith(
        'specific-token-123',
        '1995-06-15',
        expect.any(Object),
      );
      expect(mockOAuthService.completeOauthRegister).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing user-agent header gracefully', async () => {
      const mockOauthCallbackDto = { providerTokenId: 'token-123' };

      mockOAuthService.handleOauthToken.mockResolvedValue({
        access_token: 'token',
        refresh_token: 'refresh',
      });

      // Empty string simulates missing header
      await controller.providerCallback('github', mockOauthCallbackDto, '');

      expect(mockOAuthService.handleOauthToken).toHaveBeenCalledTimes(1);
      const parsedAgent = mockOAuthService.handleOauthToken.mock.calls[0][2];
      expect(parsedAgent).toBeDefined();
    });

    it('should handle malformed user-agent string', async () => {
      const malformedUserAgent = 'not-a-real-user-agent!!!@@@###';
      const mockOauthCallbackDto = { providerTokenId: 'token-123' };

      mockOAuthService.handleOauthToken.mockResolvedValue({
        access_token: 'token',
        refresh_token: 'refresh',
      });

      await controller.providerCallback('github', mockOauthCallbackDto, malformedUserAgent);

      expect(mockOAuthService.handleOauthToken).toHaveBeenCalledTimes(1);
    });
  });
});