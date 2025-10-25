import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs'; // needed to create mock Observable responses
import { RecaptchaService } from './recaptcha.service';

describe('RecaptchaService', () => {
  let service: RecaptchaService;
  let mockHttpService: Partial<HttpService>;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(async () => {
    mockHttpService = {
      post: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('mock-secret-key'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecaptchaService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
        Logger,
      ],
    }).compile();

    service = module.get<RecaptchaService>(RecaptchaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should throw an error if RECAPTCHA_SECRET_KEY is not defined', () => {
      (mockConfigService.get as jest.Mock).mockReturnValue(undefined);

      expect(
        () =>
          new RecaptchaService(mockHttpService as HttpService, mockConfigService as ConfigService),
      ).toThrow('Secret key is not defined in configuration');
    });
  });

  describe('validateToken', () => {
    it('should return true for a valid token and a successful API response', async () => {
      const token = 'valid-recaptcha-token';
      // This is the structure of a successful response from Google's API.
      const apiResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
      };
      (mockHttpService.post as jest.Mock).mockReturnValue(of(apiResponse));

      const result = await service.validateToken(token);

      expect(result).toBe(true);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'https://www.google.com/recaptcha/api/siteverify',
        expect.any(String),
        expect.any(Object),
      );
    });

    it('should return false if the API response indicates failure', async () => {
      const token = 'invalid-recaptcha-token';
      const apiResponse = {
        data: { success: false, 'error-codes': ['invalid-input-response'] },
        status: 200,
        statusText: 'OK',
        headers: {},
      };
      (mockHttpService.post as jest.Mock).mockReturnValue(of(apiResponse));

      const result = await service.validateToken(token);

      expect(result).toBe(false);
    });

    it('should return false if the HTTP request to the API fails', async () => {
      const token = 'any-token';
      // `throwError()` is an RxJS function that creates an Observable that immediately errors out.
      (mockHttpService.post as jest.Mock).mockReturnValue(
        throwError(() => new Error('Network timeout')),
      );

      const result = await service.validateToken(token);
      expect(result).toBe(false);
    });
  });
});
