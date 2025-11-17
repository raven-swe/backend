import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GithubOAuthStrategy } from 'src/auth/strategies';
import { ProviderProfile } from 'src/auth/interfaces';

// Mock fetch globally
global.fetch = jest.fn();

describe('GithubOAuthStrategy', () => {
  let strategy: GithubOAuthStrategy;
  let configService: ConfigService;

  const mockConfig = {
    GITHUB_CLIENT_ID: 'test-client-id',
    GITHUB_CLIENT_SECRET: 'test-client-secret',
    GITHUB_REDIRECT_URI: 'http://localhost:3000/auth/github/callback',
  };

  const mockGithubUser = {
    id: 12345678,
    email: 'test@example.com',
    name: 'Test User',
    login: 'testuser',
    avatar_url: 'https://avatars.githubusercontent.com/u/12345678',
  };

  const mockGithubEmails = [
    {
      email: 'test@example.com',
      primary: true,
      verified: true,
    },
    {
      email: 'secondary@example.com',
      primary: false,
      verified: true,
    },
  ];

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => mockConfig[key as keyof typeof mockConfig]),
    } as unknown as ConfigService;

    strategy = new GithubOAuthStrategy(configService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('validateToken', () => {
    const mockProviderToken = 'github-auth-code-123';

    it('should successfully validate token and return provider profile', async () => {
      // Mock access token exchange
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ access_token: 'github-access-token-xyz' }),
      });

      // Mock user data fetch
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockGithubUser),
      });

      const result = await strategy.validateToken(mockProviderToken);

      const expected: ProviderProfile = {
        id: '12345678',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345678',
        provider: 'github',
      };

      expect(result).toEqual(expected);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenNthCalledWith(1, 'https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: mockConfig.GITHUB_CLIENT_ID,
          client_secret: mockConfig.GITHUB_CLIENT_SECRET,
          code: mockProviderToken,
          redirect_uri: mockConfig.GITHUB_REDIRECT_URI,
        }),
      });
    });

    it('should handle user with null avatar_url', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ access_token: 'github-access-token-xyz' }),
      });

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ...mockGithubUser,
          avatar_url: null,
        }),
      });

      const result = await strategy.validateToken(mockProviderToken);

      expect(result.avatar_url).toBeNull();
    });

    it('should throw BadRequestException when access token exchange fails', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });
      const result = strategy.validateToken(mockProviderToken);

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when access_token is missing in response', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      await expect(strategy.validateToken(mockProviderToken)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user data fetch fails', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ access_token: 'github-access-token-xyz' }),
      });

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      await expect(strategy.validateToken(mockProviderToken)).rejects.toThrow(BadRequestException);
    });

    describe('Email handling', () => {
      it('should fetch emails when email is not in user data', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ access_token: 'github-access-token-xyz' }),
        });

        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            ...mockGithubUser,
            email: null,
          }),
        });

        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockGithubEmails),
        });

        const result = await strategy.validateToken(mockProviderToken);

        expect(result.email).toBe('test@example.com');
        expect(fetch).toHaveBeenCalledTimes(3);
        expect(fetch).toHaveBeenNthCalledWith(3, 'https://api.github.com/user/emails', {
          headers: { Authorization: 'Bearer github-access-token-xyz' },
        });
      });

      it('should throw UnauthorizedException when email fetch fails', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ access_token: 'github-access-token-xyz' }),
        });

        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            ...mockGithubUser,
            email: null,
          }),
        });

        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          status: 403,
        });

        await expect(strategy.validateToken(mockProviderToken)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should throw UnauthorizedException when no verified primary email exists', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ access_token: 'github-access-token-xyz' }),
        });

        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            ...mockGithubUser,
            email: null,
          }),
        });

        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue([
            {
              email: 'unverified@example.com',
              primary: true,
              verified: false,
            },
            {
              email: 'notprimary@example.com',
              primary: false,
              verified: true,
            },
          ]),
        });

        await expect(strategy.validateToken(mockProviderToken)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should find primary verified email from multiple emails', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ access_token: 'github-access-token-xyz' }),
        });

        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            ...mockGithubUser,
            email: null,
          }),
        });

        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue([
            {
              email: 'secondary@example.com',
              primary: false,
              verified: true,
            },
            {
              email: 'primary@example.com',
              primary: true,
              verified: true,
            },
            {
              email: 'unverified@example.com',
              primary: false,
              verified: false,
            },
          ]),
        });

        const result = await strategy.validateToken(mockProviderToken);

        expect(result.email).toBe('primary@example.com');
      });

      it('should handle empty emails array', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ access_token: 'github-access-token-xyz' }),
        });

        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            ...mockGithubUser,
            email: null,
          }),
        });

        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue([]),
        });

        await expect(strategy.validateToken(mockProviderToken)).rejects.toThrow(
          UnauthorizedException,
        );
      });
    });

    describe('Edge cases', () => {
      it('should handle network errors during token exchange', async () => {
        (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

        await expect(strategy.validateToken(mockProviderToken)).rejects.toThrow('Network error');
      });

      it('should handle malformed JSON in token response', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
        });

        await expect(strategy.validateToken(mockProviderToken)).rejects.toThrow('Invalid JSON');
      });

      it('should convert numeric id to string', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ access_token: 'github-access-token-xyz' }),
        });

        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            ...mockGithubUser,
            id: 99999999,
          }),
        });

        const result = await strategy.validateToken(mockProviderToken);

        expect(result.id).toBe('99999999');
        expect(typeof result.id).toBe('string');
      });

      it('should handle string id from GitHub', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ access_token: 'github-access-token-xyz' }),
        });

        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            ...mockGithubUser,
            id: '12345678',
          }),
        });

        const result = await strategy.validateToken(mockProviderToken);

        expect(result.id).toBe('12345678');
      });
    });

    describe('Configuration', () => {
      it('should use correct GitHub API endpoints', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ access_token: 'test-token' }),
        });

        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockGithubUser),
        });

        await strategy.validateToken(mockProviderToken);

        expect(fetch).toHaveBeenNthCalledWith(
          1,
          'https://github.com/login/oauth/access_token',
          expect.any(Object),
        );

        expect(fetch).toHaveBeenNthCalledWith(
          2,
          'https://api.github.com/user',
          expect.objectContaining({
            headers: { Authorization: 'Bearer test-token' },
          }),
        );
      });

      it('should include all required OAuth parameters', async () => {
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ access_token: 'test-token' }),
        });

        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockGithubUser),
        });

        await strategy.validateToken(mockProviderToken);

        const callArgs = (fetch as jest.Mock).mock.calls[0] as unknown[];
        const fetchOptions = callArgs[1] as { body: string };
        const requestBody = JSON.parse(fetchOptions.body) as {
          client_id: string;
          client_secret: string;
          code: string;
          redirect_uri: string;
        };

        expect(requestBody).toEqual({
          client_id: mockConfig.GITHUB_CLIENT_ID,
          client_secret: mockConfig.GITHUB_CLIENT_SECRET,
          code: mockProviderToken,
          redirect_uri: mockConfig.GITHUB_REDIRECT_URI,
        });
      });
    });
  });
});
