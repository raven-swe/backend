import { HttpException, HttpStatus } from '@nestjs/common';
import { generateAndStoreOtp } from './otp.util';
import { RedisService } from 'src/redis/redis.service';
import { Queue } from 'bullmq';
import { OtpType } from 'src/email/interfaces/email.interfaces';
import {
  AUTH_ERROR_MESSAGES,
  AUTH_ERROR_CODES,
  AUTH_CONFIG,
  REDIS_KEYS,
} from 'src/common/constants/auth.constants';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

// Mock dependencies
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

jest.mock('crypto', () => ({
  randomInt: jest.fn(),
}));

describe('generateAndStoreOtp', () => {
  let redisService: RedisService;

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockEmailQueue = {
    add: jest.fn(),
    close: jest.fn(),
  };

  beforeEach(() => {
    redisService = mockRedisService as unknown as RedisService;

    jest.clearAllMocks();

    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedOtpValue' as never);
    (crypto.randomInt as jest.Mock).mockReturnValue(123456);
  });

  const baseParams = {
    redisKey: REDIS_KEYS.PASSWORD_RESET('mocked-token'),
    email: 'test@gmail.com',
    resendKey: REDIS_KEYS.OTP_RESEND_PASSWORD_RESET('test@gmail.com'),
    ttl: 300,
    data: { email: 'test@gmail.com', otp: '', verified: false },
    emailQueue: mockEmailQueue as unknown as Queue,
    otpType: OtpType.FORGOT_PASSWORD,
  };

  describe('successful OTP generation and storage', () => {
    it('should generate a 6-digit OTP', async () => {
      // Act
      const otp = await generateAndStoreOtp(baseParams, redisService);

      // Assert
      expect(otp).toBe('123456');
      expect(bcrypt.hash).toHaveBeenCalledWith('123456', 10);
      expect(crypto.randomInt).toHaveBeenCalledWith(100000, 999999);
    });

    it('should store hashed OTP and data to Redis with correct TTL', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(null);

      // Act
      await generateAndStoreOtp(baseParams, redisService);

      // Assert
      expect(mockRedisService.set).toHaveBeenCalledWith(
        baseParams.redisKey,
        expect.stringContaining('hashedOtpValue'),
        baseParams.ttl,
      );
    });

    it('should increment resend attempt counter', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue('OK');

      // Act
      await generateAndStoreOtp(baseParams, redisService);

      // Assert
      expect(mockRedisService.set).toHaveBeenCalledWith(
        baseParams.resendKey,
        '1',
        AUTH_CONFIG.OTP_RESEND_WINDOW,
      );
    });

    it('should increment existing resend attempt counter', async () => {
      mockRedisService.get.mockResolvedValue('2');
      mockRedisService.set.mockResolvedValue('OK');

      await generateAndStoreOtp(baseParams, redisService);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        baseParams.resendKey,
        '3',
        AUTH_CONFIG.OTP_RESEND_WINDOW,
      );
    });

    it('should queue email job with username for forgot password', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue('OK');

      const paramsWithUsername = {
        ...baseParams,
        otpType: OtpType.FORGOT_PASSWORD,
        username: 'testuser',
      };

      await generateAndStoreOtp(paramsWithUsername, redisService);

      expect(mockEmailQueue.add).toHaveBeenCalledWith('sendOtp', {
        type: OtpType.FORGOT_PASSWORD,
        email: baseParams.email,
        otp: '123456',
        username: 'testuser',
      });
    });

    it('should queue email job with username for registration', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue('OK');

      const params = {
        ...baseParams,
        otpType: OtpType.REGISTRATION,
        redisKey: REDIS_KEYS.REGISTRATION('mocked-token'),
        resendKey: REDIS_KEYS.OTP_RESEND('test@gmail.com'),
      };

      await generateAndStoreOtp(params, redisService);

      expect(mockEmailQueue.add).toHaveBeenCalledWith('sendOtp', {
        type: OtpType.REGISTRATION,
        email: baseParams.email,
        otp: '123456',
      });
    });

    it('should set verified to false', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue('OK');

      await generateAndStoreOtp(baseParams, redisService);

      const setCall = mockRedisService.set.mock.calls[0] as [string, string, number];
      const storedData = JSON.parse(setCall[1]) as unknown as { verified: boolean };
      expect(storedData.verified).toBe(false);
    });
  });

  describe('rate limiting', () => {
    it('should throw OTP_RESEND_LIMIT_EXCEEDED error when limit is reached', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(AUTH_CONFIG.OTP_RESEND_LIMIT.toString());

      // Act & Assert
      await expect(generateAndStoreOtp(baseParams, redisService)).rejects.toThrow(
        new HttpException(
          {
            message: AUTH_ERROR_MESSAGES.OTP_RESEND_LIMIT_EXCEEDED,
            code: AUTH_ERROR_CODES.OTP_RESEND_LIMIT_EXCEEDED,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );

      expect(mockRedisService.get).toHaveBeenCalledWith(baseParams.resendKey);
      expect(mockRedisService.set).not.toHaveBeenCalled();
      expect(mockEmailQueue.add).not.toHaveBeenCalled();
    });

    it('should throw OTP_RESEND_LIMIT_EXCEEDED when attempts exceed limit', async () => {
      mockRedisService.get.mockResolvedValue((AUTH_CONFIG.OTP_RESEND_LIMIT + 1).toString());

      await expect(generateAndStoreOtp(baseParams, redisService)).rejects.toThrow(
        new HttpException(
          {
            message: AUTH_ERROR_MESSAGES.OTP_RESEND_LIMIT_EXCEEDED,
            code: AUTH_ERROR_CODES.OTP_RESEND_LIMIT_EXCEEDED,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );
    });
  });
});
