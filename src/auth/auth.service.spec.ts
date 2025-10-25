import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { BadRequestException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RecaptchaService } from 'src/recaptcha/recaptcha.service';
import { getQueueToken } from '@nestjs/bullmq';
import { DevicesService } from 'src/devices/devices.service';
import { RefreshTokensService } from 'src/refresh-tokens/refresh-tokens.service';
import { PrismaService } from 'src/prisma/prisma.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

import {
  AUTH_CONFIG,
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
  REDIS_KEYS,
} from 'src/auth/constants/auth.constants';
import { OtpType } from 'src/email/interfaces/email.interfaces';
import { generateAndStoreOtp } from './utils/otp.util';
import { hashPassword } from './utils/password.util';
import { CachedRegistrationData } from './interfaces/CachedRegistrationData.interface';
import { DeviceType } from 'src/devices/interfaces/device.interface';
import { createValidationError } from 'src/common/utils/create-validation-error.util';

jest.mock('bcrypt');

jest.mock('crypto', () => ({
  randomUUID: jest.fn(),
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('mock-refresh-token-hex-string'),
  }),
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(),
  }),
}));

jest.mock('./utils/otp.util', () => ({
  generateAndStoreOtp: jest.fn().mockResolvedValue(123456),
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  const mockUsersService = {
    findByIdentifier: jest.fn(),
    updatePasswordById: jest.fn(),
    findByEmail: jest.fn(),
    createUser: jest.fn(),
  };

  const mockDevicesService = {
    removeAllUserDevices: jest.fn(),
    createDevice: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    ttl: jest.fn().mockResolvedValue(AUTH_CONFIG.OTP_RESEND_WINDOW),
  };

  const mockEmailQueue = {
    add: jest.fn(),
    close: jest.fn(),
  };

  const mockUser = {
    id: 1234,
    email: 'test@gmail.com',
    username: 'testuser',
    password: 'hashedPassword',
  };

  const mockPasswordResetData = {
    email: 'test@gmail.com',
    userId: '1234',
    otp: 'hashedOtpValue',
    verified: false,
  };

  let service: AuthService;
  let mockJwtService: Partial<JwtService>;
  let mockRecaptchaService: Partial<RecaptchaService>;
  let mockRefreshTokensService: Partial<RefreshTokensService>;
  let mockPrismaService: Partial<PrismaService>;

  beforeEach(async () => {
    mockJwtService = {
      signAsync: jest.fn(),
    };
    mockRecaptchaService = {
      validateToken: jest.fn(),
    };

    mockRefreshTokensService = {
      createRefreshToken: jest.fn(),
    };

    mockPrismaService = {
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        Logger,
        { provide: RedisService, useValue: mockRedisService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: DevicesService, useValue: mockDevicesService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: RecaptchaService, useValue: mockRecaptchaService },
        { provide: RefreshTokensService, useValue: mockRefreshTokensService },
        { provide: getQueueToken('email'), useValue: mockEmailQueue },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
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
      (mockRecaptchaService.validateToken as jest.Mock).mockResolvedValue(true);
      (generateAndStoreOtp as jest.Mock).mockResolvedValue(undefined); // success
      (crypto.randomUUID as jest.Mock).mockReturnValue('test-uuid');

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
        mockRedisService,
      );
    });
  });

  describe('verifyForgotPassword', () => {
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
        new BadRequestException(
          createValidationError('confirmationToken', {
            invalidToken: AUTH_ERROR_MESSAGES.INVALID_CONFIRMATION_TOKEN,
          }),
        ),
      );
    });
  });

  describe('startRegistration', () => {
    it('should start registration successfully', async () => {
      const startRegistrationDto = {
        email: 'test@gmail.com',
        name: 'test',
        birthDate: new Date('2000-01-01'),
        recaptchaToken: 'token',
      };

      // Arrange
      mockUsersService.findByEmail.mockResolvedValue(null);
      (mockRecaptchaService.validateToken as jest.Mock).mockResolvedValue(true);
      (crypto.randomUUID as jest.Mock).mockReturnValue('test-uuid');

      // Act
      const result = await service.startRegistration(startRegistrationDto);

      // Assert
      expect(result).toEqual({
        creationToken: 'test-uuid',
      });

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(startRegistrationDto.email);
      expect(generateAndStoreOtp).toHaveBeenCalledWith(
        {
          redisKey: REDIS_KEYS.REGISTRATION('test-uuid'),
          email: startRegistrationDto.email,
          resendKey: REDIS_KEYS.OTP_RESEND(startRegistrationDto.email),
          ttl: AUTH_CONFIG.REGISTRATION_TTL,
          data: {
            email: startRegistrationDto.email,
            name: startRegistrationDto.name,
            birthDate: startRegistrationDto.birthDate,
            otp: '',
            verified: false,
          },
          emailQueue: mockEmailQueue,
          otpType: OtpType.REGISTRATION,
        },
        mockRedisService,
      );
    });

    it('should throw error if email is already registered', async () => {
      const startRegistrationDto = {
        email: 'test@gmail.com',
        name: 'test',
        birthDate: new Date('2000-01-01'),
        recaptchaToken: 'token',
      };

      // arrange
      mockUsersService.findByEmail.mockResolvedValue({ id: 1 });

      // act & assert
      await expect(service.startRegistration(startRegistrationDto)).rejects.toEqual(
        new HttpException(
          { message: 'Email is already registered', code: 'EMAIL_REGISTERED' },
          HttpStatus.BAD_REQUEST,
        ),
      );
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(startRegistrationDto.email);
    });

    it('should throw HttpException when OTP resend limit is reached', async () => {
      const startRegistrationDto = {
        email: 'test@gmail.com',
        name: 'test',
        birthDate: new Date('2000-01-01'),
        recaptchaToken: 'token',
      };

      // arrange
      mockUsersService.findByEmail.mockResolvedValue(null);
      (mockRecaptchaService.validateToken as jest.Mock).mockResolvedValue(true);
      (generateAndStoreOtp as jest.Mock).mockRejectedValue(
        new HttpException(
          {
            message: AUTH_ERROR_MESSAGES.OTP_RESEND_LIMIT_EXCEEDED,
            code: AUTH_ERROR_CODES.OTP_RESEND_LIMIT_EXCEEDED,
            retryAfter: AUTH_CONFIG.OTP_RESEND_WINDOW,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );

      // act & assert
      await expect(service.startRegistration(startRegistrationDto)).rejects.toEqual(
        new HttpException(
          new HttpException(
            {
              message: AUTH_ERROR_MESSAGES.OTP_RESEND_LIMIT_EXCEEDED,
              code: AUTH_ERROR_CODES.OTP_RESEND_LIMIT_EXCEEDED,
              retryAfter: AUTH_CONFIG.OTP_RESEND_WINDOW,
            },
            HttpStatus.TOO_MANY_REQUESTS,
          ),
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(startRegistrationDto.email);
    });
  });

  describe('verifyOtp', () => {
    const dto = { creationToken: 'test-token', otp: '123456' };
    const cachedData: CachedRegistrationData = {
      email: 'test@email.com',
      name: 'Test',
      birthDate: new Date(),
      otp: 'hashed-otp',
      verified: false,
    };
    const mockConfirmationToken = '';

    it('should successfully verify a correct OTP', async () => {
      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedData));
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.verifyOtp(dto);

      expect(result).toEqual({ message: 'OTP verified successfully' });
      const expectedUpdatedData = { ...cachedData, verified: true }; //check verified
      expect(mockRedisService.set).toHaveBeenCalledWith(
        REDIS_KEYS.REGISTRATION(dto.creationToken),
        JSON.stringify(expectedUpdatedData),
        AUTH_CONFIG.REGISTRATION_TTL,
      );
    });

    it('should throw an error for an invalid creation token', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(null);

      // Act & Assert
      await expect(service.verifyOtp(dto)).rejects.toThrow(
        new BadRequestException(
          createValidationError('recaptchaToken', {
            invalidToken: AUTH_ERROR_MESSAGES.INVALID_RECAPTCHA_TOKEN,
          }),
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
        new BadRequestException(
          createValidationError('otp', {
            invalidToken: AUTH_ERROR_MESSAGES.OTP_INVALID,
          }),
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
        new BadRequestException(
          createValidationError('confirmationToken', {
            invalidToken: AUTH_ERROR_MESSAGES.OTP_NOT_VERIFIED,
          }),
        ),
      );
    });

    it('should throw an error for an incorrect OTP', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedData));
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(service.verifyOtp(dto)).rejects.toThrow(
        new BadRequestException(
          createValidationError('otp', {
            invalidToken: AUTH_ERROR_MESSAGES.OTP_INVALID,
          }),
        ),
      );
    });
  });

  describe('resetPassword', () => {
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
      expect(mockUsersService.updatePasswordById).toHaveBeenCalledWith(
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

    it('should throw INVALID_CONFIRMATION_TOKEN when redis data does not exist', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(null);

      const mockResetPasswordDto = {
        confirmationToken: mockConfirmationToken,
        newPassword: 'NewPassword1!',
      };

      // Act
      await expect(service.resetPassword(mockResetPasswordDto)).rejects.toThrow(
        new BadRequestException(
          createValidationError('confirmationToken', {
            invalidToken: AUTH_ERROR_MESSAGES.INVALID_CONFIRMATION_TOKEN,
          }),
        ),
      );
    });
  });

  describe('completeRegistration', () => {
    const dto = { creationToken: 'test-token', password: 'Password1!', deviceType: DeviceType.WEB };
    const cachedData: CachedRegistrationData = {
      email: 'test@email.com',
      name: 'Test',
      birthDate: new Date(),
      otp: 'hashed-otp',
      verified: true,
    };
    const deviceType = DeviceType.WEB;

    it('should successfully complete the registration', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedData));
      jest
        .spyOn(service, 'generateAccessToken' as keyof AuthService)
        .mockResolvedValue('access-token');
      jest
        .spyOn(service, 'createUserAndDeviceAndToken' as keyof AuthService)
        .mockResolvedValue(BigInt(1).toString());

      // Act
      const result = await service.completeRegistration(dto, '127.0.0.1', deviceType);

      // Assert
      expect(result.message).toBe('Registration completed successfully');
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('mock-refresh-token-hex-string');
      //check that the cleanup logic was called.
      expect(mockRedisService.del).toHaveBeenCalledWith(REDIS_KEYS.REGISTRATION(dto.creationToken));
      expect(mockRedisService.del).toHaveBeenCalledWith(REDIS_KEYS.OTP_RESEND(cachedData.email));

      // i believe testing the transaction is not unit test's job
    });

    it('should throw an error if OTP was not verified first', async () => {
      const unverifiedData = { ...cachedData, verified: false };
      mockRedisService.get.mockResolvedValue(JSON.stringify(unverifiedData));

      // Act & Assert
      await expect(service.completeRegistration(dto, '127.0.0.1', deviceType)).rejects.toThrow(
        new BadRequestException(
          createValidationError('otp', {
            invalidToken: AUTH_ERROR_MESSAGES.OTP_NOT_VERIFIED,
          }),
        ),
      );
    });

    it('should throw an error for an invalid creation token', async () => {
      mockRedisService.get.mockResolvedValue(null);
      await expect(service.completeRegistration(dto, 'string', deviceType)).rejects.toThrow(
        new BadRequestException(
          createValidationError('recaptchaToken', {
            invalidToken: AUTH_ERROR_MESSAGES.INVALID_RECAPTCHA_TOKEN,
          }),
        ),
      );
    });
  });

  describe('resendPasswordOtp', () => {
    it('should call generateAndStoreOtp to resend OTP', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(JSON.stringify(mockPasswordResetData));
      (generateAndStoreOtp as jest.Mock).mockResolvedValue(undefined); // success

      // Act
      const result = await service.resendPasswordOtp({ confirmationToken: '' });

      // Assert
      expect(result).toHaveProperty('message', 'OTP resent successfully.');
      expect(generateAndStoreOtp).toHaveBeenCalledTimes(1);
      expect(generateAndStoreOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            email: mockPasswordResetData.email,
            otp: '',
            userId: mockPasswordResetData.userId,
            verified: false,
          },
          email: mockPasswordResetData.email,
          otpType: OtpType.FORGOT_PASSWORD,
          redisKey: REDIS_KEYS.PASSWORD_RESET(''),
          resendKey: REDIS_KEYS.OTP_RESEND_PASSWORD_RESET(mockPasswordResetData.email),
          ttl: AUTH_CONFIG.PASSWORD_RESET_TTL,
        }),
        mockRedisService,
      );
    });

    it('should throw INVALID_TOKEN when redis data does not exist', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(null);

      // Act
      await expect(service.resendPasswordOtp({ confirmationToken: '' })).rejects.toThrow(
        new BadRequestException(
          createValidationError('confirmationToken', {
            invalidToken: AUTH_ERROR_MESSAGES.INVALID_CONFIRMATION_TOKEN,
          }),
        ),
      );
    });
  });

  describe('resendOtp', () => {
    const creationToken = 'test-token';
    const cachedData: CachedRegistrationData = {
      email: 'test@gmail.com',
      name: 'test',
      birthDate: new Date(),
      otp: 'old-otp',
      verified: false,
    };

    it('should successfully resend an OTP', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedData));
      (generateAndStoreOtp as jest.Mock).mockResolvedValue(undefined); // success

      // Act
      const result = await service.resendOtp(creationToken);

      // Assert
      expect(result).toEqual({ message: 'OTP resent successfully' });
      expect(generateAndStoreOtp).toHaveBeenCalledWith(
        {
          redisKey: REDIS_KEYS.REGISTRATION(creationToken),
          email: cachedData.email,
          resendKey: REDIS_KEYS.OTP_RESEND(cachedData.email),
          ttl: AUTH_CONFIG.REGISTRATION_TTL,
          data: {
            ...cachedData,
            birthDate: cachedData.birthDate.toISOString(),
          },
          emailQueue: mockEmailQueue,
          otpType: OtpType.REGISTRATION,
        },
        mockRedisService,
      );
    });

    it('should throw an error for an invalid creation token', async () => {
      mockRedisService.get.mockResolvedValue(null);

      await expect(service.resendOtp(creationToken)).rejects.toThrow(
        new BadRequestException(
          createValidationError('recaptchaToken', {
            invalidToken: AUTH_ERROR_MESSAGES.INVALID_RECAPTCHA_TOKEN,
          }),
        ),
      );
    });
  });

  describe('checkEmail', () => {
    it('should return { a message and exists: true } if an email is found', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: 1 });
      const result = await service.checkEmail('exists@example.com');
      expect(result).toStrictEqual({
        message: 'Email already exists',
        exists: true,
      });
    });

    it('should return { a message and exists: false } if an email is not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      const result = await service.checkEmail('new@example.com');
      expect(result).toStrictEqual({
        message: 'Email is available',
        exists: false,
      });
    });
  });

  describe('verifyRecaptcha', () => {
    it('should return true if the token is valid', async () => {
      (mockRecaptchaService.validateToken as jest.Mock).mockResolvedValue(true);
      const result = await service.verifyRecaptcha('valid-token');
      expect(result).toBe(true);
      expect(mockRecaptchaService.validateToken).toHaveBeenCalledWith('valid-token');
    });

    it('should return false if the token is invalid', async () => {
      (mockRecaptchaService.validateToken as jest.Mock).mockResolvedValue(false);
      const result = await service.verifyRecaptcha('invalid-token');
      expect(result).toBe(false);
      expect(mockRecaptchaService.validateToken).toHaveBeenCalledWith('invalid-token');
    });
  });
});
