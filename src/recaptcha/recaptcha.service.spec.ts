import { Test, TestingModule } from '@nestjs/testing';
import { RecaptchaService } from './recaptcha.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';

describe('RecaptchaService', () => {
  let service: RecaptchaService;
  let configService: jest.Mocked<ConfigService>;

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecaptchaService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RecaptchaService>(RecaptchaService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should create service successfully', () => {
      expect(service).toBeDefined();
      expect(configService).toBeDefined();
    });

    it('should use default test secret key if config is not available', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RecaptchaService,
          {
            provide: HttpService,
            useValue: mockHttpService,
          },
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const newService = module.get<RecaptchaService>(RecaptchaService);
      expect(newService).toBeDefined();
    });
  });

  describe('validateToken', () => {
    it('should return false if no token is provided', async () => {
      const result = await service.validateToken('');

      expect(result).toBe(false);
      expect(mockHttpService.post).not.toHaveBeenCalled();
    });

    it('should return true for valid token', async () => {
      const token = 'valid-token-123';
      const mockResponse = {
        data: {
          success: true,
          challenge_ts: '2024-10-24T10:00:00Z',
          hostname: 'localhost',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: {},
        },
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.validateToken(token);

      expect(result).toBe(true);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'https://www.google.com/recaptcha/api/siteverify',
        expect.any(String),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );
    });

    it('should return false for invalid token (success: false)', async () => {
      const token = 'invalid-token';
      const mockResponse = {
        data: {
          success: false,
          'error-codes': ['invalid-input-response'],
          challenge_ts: '2024-10-24T10:00:00Z',
          hostname: 'localhost',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: {},
        },
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.validateToken(token);

      expect(result).toBe(false);
      expect(mockHttpService.post).toHaveBeenCalled();
    });

    it('should return false if HTTP request fails', async () => {
      const token = 'some-token';
      const error = new Error('Network error');

      mockHttpService.post.mockReturnValue(throwError(() => error));

      const result = await service.validateToken(token);

      expect(result).toBe(false);
      expect(mockHttpService.post).toHaveBeenCalled();
    });

    it('should return false if response data is malformed', async () => {
      const token = 'some-token';
      const mockResponse = {
        data: null,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: {},
        },
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.validateToken(token);

      expect(result).toBe(false);
    });

    it('should handle timeout errors', async () => {
      const token = 'some-token';
      const timeoutError = new Error('Timeout');

      mockHttpService.post.mockReturnValue(throwError(() => timeoutError));

      const result = await service.validateToken(token);

      expect(result).toBe(false);
      expect(mockHttpService.post).toHaveBeenCalled();
    });

    it('should send correct payload format', async () => {
      const token = 'test-token-456';
      const mockResponse = {
        data: {
          success: true,
          challenge_ts: '2024-10-24T10:00:00Z',
          hostname: 'localhost',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: {},
        },
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      await service.validateToken(token);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        'https://www.google.com/recaptcha/api/siteverify',
        expect.stringContaining('response=test-token-456'),
        expect.any(Object),
      );
      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('secret='),
        expect.any(Object),
      );
    });

    it('should handle response with error codes', async () => {
      const token = 'expired-token';
      const mockResponse = {
        data: {
          success: false,
          'error-codes': ['timeout-or-duplicate'],
          challenge_ts: '2024-10-24T10:00:00Z',
          hostname: 'localhost',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: {},
        },
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.validateToken(token);

      expect(result).toBe(false);
    });
  });
});
