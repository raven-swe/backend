import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleOAuthStrategy } from './oauth.google.strategy';
import { ProviderProfile } from '../types/oauth.type';
import { OAuth2Client, TokenPayload } from 'google-auth-library';

// Mock google-auth-library
jest.mock('google-auth-library');

// Mock fetch globally
global.fetch = jest.fn();

describe('GoogleOAuthStrategy', () => {
  let strategy: GoogleOAuthStrategy;
  let configService: ConfigService;
  let mockOAuth2Client: jest.Mocked<OAuth2Client>;

  const mockConfig = {
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:3000/auth/google/callback',
  };

  const mockGoogleTokenResponse = {
    access_token: 'ya29.test-access-token',
    expires_in: 3599,
    scope: 'openid profile email',
    id_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test-id-token',
  };

  const mockTokenPayload: TokenPayload = {
    sub: 'google-user-id-123456789',
    email: 'test@gmail.com',
    name: 'Test User',
    picture: 'https://lh3.googleusercontent.com/a/test-photo',
    email_verified: true,
    iss: 'https://accounts.google.com',
    aud: mockConfig.GOOGLE_CLIENT_ID,
    iat: Date.now() / 1000,
    exp: Date.now() / 1000 + 3600,
  };

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => mockConfig[key as keyof typeof mockConfig]),
    } as unknown as ConfigService;

    // Create mock OAuth2Client instance
    mockOAuth2Client = {
      verifyIdToken: jest.fn(),
    } as unknown as jest.Mocked<OAuth2Client>;

    // Mock OAuth2Client constructor
    (OAuth2Client as jest.MockedClass<typeof OAuth2Client>).mockImplementation(
      () => mockOAuth2Client,
    );

    strategy = new GoogleOAuthStrategy(configService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('validateToken', () => {
    const mockProviderToken = 'google-auth-code-123';

    it('should successfully validate token and return provider profile', async () => {
      // Mock token exchange
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockGoogleTokenResponse),
      });

      // Mock ID token verification
      mockOAuth2Client.verifyIdToken.mockResolvedValueOnce({
        getPayload: () => mockTokenPayload,
      } as never);

      const result = await strategy.validateToken(mockProviderToken);

      const expected: ProviderProfile = {
        provider: 'google',
        id: 'google-user-id-123456789',
        email: 'test@gmail.com',
        name: 'Test User',
        avatar_url: 'https://lh3.googleusercontent.com/a/test-photo',
      };

      expect(result).toEqual(expected);
      expect(fetch).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockOAuth2Client.verifyIdToken).toHaveBeenCalledWith({
        idToken: mockGoogleTokenResponse.id_token,
        audience: mockConfig.GOOGLE_CLIENT_ID,
      });
    });

    it('should handle user without profile picture', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockGoogleTokenResponse),
      });

      mockOAuth2Client.verifyIdToken.mockResolvedValueOnce({
        getPayload: jest.fn(() => ({
          ...mockTokenPayload,
          picture: undefined,
        })),
      } as never);

      const result = await strategy.validateToken(mockProviderToken);

      expect(result.avatar_url).toBeNull();
    });

    it('should throw BadRequestException when token exchange fails', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      await expect(strategy.validateToken(mockProviderToken)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when id_token is missing', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'test-token',
          expires_in: 3599,
          scope: 'openid profile email',
        }),
      });

      await expect(strategy.validateToken(mockProviderToken)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when ID token verification fails', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockGoogleTokenResponse),
      });

      mockOAuth2Client.verifyIdToken.mockResolvedValueOnce(null as never);

      await expect(strategy.validateToken(mockProviderToken)).rejects.toThrow(BadRequestException);
    });

    describe('Incomplete user profile', () => {
      it('should throw UnauthorizedException when payload is null', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockGoogleTokenResponse),
        });

        mockOAuth2Client.verifyIdToken.mockResolvedValueOnce({
          getPayload: jest.fn(() => null),
        } as never);

        await expect(strategy.validateToken(mockProviderToken)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should throw UnauthorizedException when email is missing', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockGoogleTokenResponse),
        });

        mockOAuth2Client.verifyIdToken.mockResolvedValueOnce({
          getPayload: jest.fn(() => ({
            ...mockTokenPayload,
            email: undefined,
          })),
        } as never);

        await expect(strategy.validateToken(mockProviderToken)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should throw UnauthorizedException when name is missing', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockGoogleTokenResponse),
        });

        mockOAuth2Client.verifyIdToken.mockResolvedValueOnce({
          getPayload: jest.fn(() => ({
            ...mockTokenPayload,
            name: undefined,
          })),
        } as never);

        await expect(strategy.validateToken(mockProviderToken)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should throw UnauthorizedException when both email and name are missing', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockGoogleTokenResponse),
        });

        mockOAuth2Client.verifyIdToken.mockResolvedValueOnce({
          getPayload: jest.fn(() => ({
            ...mockTokenPayload,
            email: undefined,
            name: undefined,
          })),
        } as never);

        await expect(strategy.validateToken(mockProviderToken)).rejects.toThrow(
          UnauthorizedException,
        );
      });
    });

    describe('OAuth2 flow', () => {
      it('should send correct request parameters for token exchange', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockGoogleTokenResponse),
        });

        mockOAuth2Client.verifyIdToken.mockResolvedValueOnce({
          getPayload: jest.fn(() => mockTokenPayload),
        } as never);

        await strategy.validateToken(mockProviderToken);

        expect(fetch).toHaveBeenCalledWith('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: expect.any(URLSearchParams) as URLSearchParams,
        });

        const callArgs = (fetch as jest.Mock).mock.calls[0] as unknown[];
        const bodyParams = callArgs[1] as { body: URLSearchParams };

        expect(bodyParams.body.get('code')).toBe(mockProviderToken);
        expect(bodyParams.body.get('client_id')).toBe(mockConfig.GOOGLE_CLIENT_ID);
        expect(bodyParams.body.get('client_secret')).toBe(mockConfig.GOOGLE_CLIENT_SECRET);
        expect(bodyParams.body.get('redirect_uri')).toBe(mockConfig.GOOGLE_REDIRECT_URI);
        expect(bodyParams.body.get('grant_type')).toBe('authorization_code');
      });

      it('should use correct Google OAuth endpoint', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockGoogleTokenResponse),
        });

        mockOAuth2Client.verifyIdToken.mockResolvedValueOnce({
          getPayload: jest.fn(() => mockTokenPayload),
        } as never);

        await strategy.validateToken(mockProviderToken);

        expect(fetch).toHaveBeenCalledWith(
          'https://oauth2.googleapis.com/token',
          expect.any(Object),
        );
      });
    });

    describe('Edge cases', () => {
      it('should handle network errors during token exchange', async () => {
        (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network timeout'));

        await expect(strategy.validateToken(mockProviderToken)).rejects.toThrow('Network timeout');
      });

      it('should handle malformed JSON in token response', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
        });

        await expect(strategy.validateToken(mockProviderToken)).rejects.toThrow('Invalid JSON');
      });

      it('should handle verifyIdToken throwing error', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockGoogleTokenResponse),
        });

        (mockOAuth2Client.verifyIdToken as jest.Mock).mockRejectedValueOnce(
          new Error('Token verification failed'),
        );

        await expect(strategy.validateToken(mockProviderToken)).rejects.toThrow(
          'Token verification failed',
        );
      });

      it('should handle empty string values in payload', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockGoogleTokenResponse),
        });

        mockOAuth2Client.verifyIdToken.mockResolvedValueOnce({
          getPayload: jest.fn(() => ({
            ...mockTokenPayload,
            email: '',
            name: '',
          })),
        } as never);

        await expect(strategy.validateToken(mockProviderToken)).rejects.toThrow(
          UnauthorizedException,
        );
      });
    });

    describe('Response validation', () => {
      it('should return all required profile fields', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockGoogleTokenResponse),
        });

        mockOAuth2Client.verifyIdToken.mockResolvedValueOnce({
          getPayload: () => mockTokenPayload,
        } as never);

        const result = await strategy.validateToken(mockProviderToken);

        expect(result).toHaveProperty('provider');
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('email');
        expect(result).toHaveProperty('name');
        expect(result).toHaveProperty('avatar_url');
        expect(result.provider).toBe('google');
      });

      it('should preserve exact values from Google payload', async () => {
        const customPayload: TokenPayload = {
          ...mockTokenPayload,
          sub: 'custom-id-999',
          email: 'custom@example.com',
          name: 'Custom Name',
          picture: 'https://custom.url/photo.jpg',
        };

        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockGoogleTokenResponse),
        });

        mockOAuth2Client.verifyIdToken.mockResolvedValueOnce({
          getPayload: jest.fn(() => customPayload),
        } as never);

        const result = await strategy.validateToken(mockProviderToken);

        expect(result.id).toBe('custom-id-999');
        expect(result.email).toBe('custom@example.com');
        expect(result.name).toBe('Custom Name');
        expect(result.avatar_url).toBe('https://custom.url/photo.jpg');
      });
    });
  });
});
