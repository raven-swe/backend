import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RecaptchaService } from 'src/recaptcha/recaptcha.service';
import { getQueueToken } from '@nestjs/bullmq';
import { DevicesService } from 'src/devices/devices.service';
import {
  AUTH_CONFIG,
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
  REDIS_KEYS,
} from 'src/common/constants/auth.constants';
import { OtpType } from 'src/email/email.service';
import { generateAndStoreOtp } from './utils/otp.util';
import * as bcrypt from 'bcrypt';
import { hashPassword } from './utils/password.util';

jest.mock('./utils/otp.util', () => ({
  generateAndStoreOtp: jest.fn().mockResolvedValue(123456),
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let redisService: RedisService;

  const mockUser = {
    id: 1234,
    email: 'test@gmail.com',
    username: 'testuser',
    password: 'hashedPassword',
  };

  const mockUsersService = {
    findByIdentifier: jest.fn(),
    updatePassword: jest.fn(),
    findByEmail: jest.fn(),
  };

  const mockDevicesService = {
    removeAllUserDevices: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockEmailQueue = {
    add: jest.fn(),
    close: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        Logger,
        { provide: RedisService, useValue: mockRedisService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: { signAsync: jest.fn() } },
        { provide: RecaptchaService, useValue: {} },
        { provide: getQueueToken('email'), useValue: mockEmailQueue },
        { provide: DevicesService, useValue: mockDevicesService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    redisService = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('forgotPassword', () => {
    it('should throw USER_NOT_FOUND when user does not exist', async () => {
      mockUsersService.findByIdentifier.mockResolvedValue(null);

      const forgotPasswordDto = { identifier: 'none', recaptchaToken: '' };

      await expect(service.forgotPassword(forgotPasswordDto)).rejects.toThrow(
        new HttpException(
          {
            message: AUTH_ERROR_MESSAGES.USER_NOT_FOUND,
            code: AUTH_ERROR_CODES.USER_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
      expect(mockUsersService.findByIdentifier).toHaveBeenCalledWith(forgotPasswordDto.identifier);
    });

    it('should generate confirmation token and call generateAndStoreOtp when user exists', async () => {
      mockUsersService.findByIdentifier.mockResolvedValue(mockUser);

      const forgotPasswordDto = { identifier: 'test@gmail.com', recaptchaToken: '' };

      const result = await service.forgotPassword(forgotPasswordDto);

      expect(result).toHaveProperty('confirmationToken');
      expect(result.confirmationToken).toBeTruthy();
      expect(typeof result.confirmationToken).toBe('string');
      expect(mockUsersService.findByIdentifier).toHaveBeenCalledWith(forgotPasswordDto.identifier);

      // Verify generateAndStoreOtp was called with correct parameters
      expect(generateAndStoreOtp).toHaveBeenCalledTimes(1);
      expect(generateAndStoreOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            email: mockUser.email,
            otp: '',
            userId: '1234',
            verified: false,
          },
          email: mockUser.email,
          otpType: OtpType.FORGOT_PASSWORD,
          redisKey: REDIS_KEYS.PASSWORD_RESET(result.confirmationToken),
          resendKey: REDIS_KEYS.OTP_RESEND_PASSWORD_RESET(mockUser.email),
          ttl: AUTH_CONFIG.PASSWORD_RESET_TTL,
        }),
        redisService,
      );
    });

    it('should generate unique confirmation tokens for different requests', async () => {
      mockUsersService.findByIdentifier.mockResolvedValue(mockUser);

      const forgotPasswordDto = { identifier: mockUser.email, recaptchaToken: '' };

      const result1 = await service.forgotPassword(forgotPasswordDto);
      const result2 = await service.forgotPassword(forgotPasswordDto);

      expect(result1.confirmationToken).not.toBe(result2.confirmationToken);
    });
  });

  describe('verifyForgotPassword', () => {
    const mockPasswordResetData = {
      email: 'test@gmail.com',
      userId: '1234',
      otp: 'hashedOtpValue',
      verified: false,
    };

    const mockConfirmationToken = '';

    it('should verify OTP and update redis when OTP is valid', async () => {
      // Arrange
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      mockRedisService.get.mockResolvedValue(JSON.stringify(mockPasswordResetData));

      const mockVerifyForgotPasswordDto = {
        otp: '123456',
        confirmationToken: mockConfirmationToken,
      };

      // Act
      const result = await service.verifyForgotPassword(mockVerifyForgotPasswordDto);

      // Assert
      expect(result).toEqual({ message: 'Password reset verified successfully.' });
      expect(mockRedisService.set).toHaveBeenCalledWith(
        REDIS_KEYS.PASSWORD_RESET(mockConfirmationToken),
        expect.stringContaining('"verified":true'),
        expect.any(Number),
      );
    });

    it('should throw INVALID_TOKEN when redis data does not exist', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(null);

      const mockVerifyForgotPasswordDto = {
        otp: '123456',
        confirmationToken: mockConfirmationToken,
      };

      // Act
      await expect(service.verifyForgotPassword(mockVerifyForgotPasswordDto)).rejects.toThrow(
        new HttpException(
          {
            message: AUTH_ERROR_MESSAGES.INVALID_TOKEN,
            code: AUTH_ERROR_CODES.INVALID_TOKEN,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw OTP_INVALID when OTP does not match', async () => {
      // Arrange
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
      mockRedisService.get.mockResolvedValue(JSON.stringify(mockPasswordResetData));

      const mockVerifyForgotPasswordDto = {
        otp: '000000',
        confirmationToken: mockConfirmationToken,
      };

      // Act
      await expect(service.verifyForgotPassword(mockVerifyForgotPasswordDto)).rejects.toThrow(
        new HttpException(
          {
            message: AUTH_ERROR_MESSAGES.OTP_INVALID,
            code: AUTH_ERROR_CODES.OTP_INVALID,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });
  });

  describe('resetPassword', () => {
    const mockPasswordResetData = {
      email: 'test@gmail.com',
      userId: '1234',
      otp: 'hashedOtpValue',
      verified: false,
    };

    const mockConfirmationToken = '';
    it('should update password, remove devices, and cleanup redis when verified', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(
        JSON.stringify({ ...mockPasswordResetData, verified: true }),
      );

      const mockResetPasswordDto = {
        confirmationToken: mockConfirmationToken,
        newPassword: 'NewPassword1!',
      };

      // Act
      const result = await service.resetPassword(mockResetPasswordDto);

      // Assert
      expect(result).toEqual({ message: 'Password has been reset successfully.' });

      const hashedPassword = await hashPassword(mockResetPasswordDto.newPassword);
      expect(mockUsersService.updatePassword).toHaveBeenCalledWith(
        BigInt(mockPasswordResetData.userId),
        hashedPassword,
      );

      expect(mockDevicesService.removeAllUserDevices).toHaveBeenCalledWith(
        BigInt(mockPasswordResetData.userId),
      );

      expect(mockRedisService.del).toHaveBeenCalledWith(
        REDIS_KEYS.PASSWORD_RESET(mockConfirmationToken),
      );
    });

    it('should throw INVALID_TOKEN when redis data does not exist', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(null);

      const mockResetPasswordDto = {
        confirmationToken: mockConfirmationToken,
        newPassword: 'NewPassword1!',
      };

      // Act
      await expect(service.resetPassword(mockResetPasswordDto)).rejects.toThrow(
        new HttpException(
          {
            message: AUTH_ERROR_MESSAGES.INVALID_TOKEN,
            code: AUTH_ERROR_CODES.INVALID_TOKEN,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw OTP_NOT_VERIFIED when OTP has not been verified', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(
        JSON.stringify({ ...mockPasswordResetData, verified: false }),
      );

      const mockResetPasswordDto = {
        confirmationToken: mockConfirmationToken,
        newPassword: 'NewPassword1!',
      };

      // Act
      await expect(service.resetPassword(mockResetPasswordDto)).rejects.toThrow(
        new HttpException(
          {
            message: AUTH_ERROR_MESSAGES.OTP_NOT_VERIFIED,
            code: AUTH_ERROR_CODES.OTP_NOT_VERIFIED,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });
  });
});
