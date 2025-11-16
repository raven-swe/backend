import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { BadRequestException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { UsersService } from 'src/users/users.service';
import { RecaptchaService } from 'src/recaptcha/recaptcha.service';
import { getQueueToken } from '@nestjs/bullmq';
import { DevicesService } from 'src/devices/devices.service';
import { RefreshTokensService } from 'src/refresh-tokens/refresh-tokens.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  AUTH_CONFIG,
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
  REDIS_KEYS,
} from './constants/auth.constants';
import { LanguageCode, Prisma } from '@prisma/client';
import { RequestUser } from './types';
import { generateAndStoreOtp } from './utils/otp.util';
import { OtpType } from 'src/email/interfaces/email.interfaces';
import { createValidationError } from 'src/common/utils/create-validation-error.util';
import { CachedRegistrationData } from './interfaces/cached-registration-data.interface';

// Type for Prisma transaction callback
type TransactionCallback<T> = (
  tx: Omit<
    PrismaService,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
  >,
) => Promise<T>;

// Mock crypto module
jest.mock('crypto', () => ({
  randomUUID: jest.fn(),
  randomBytes: () => ({
    toString: () => 'mockRefreshToken',
  }),
  createHash: () => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mockHashedToken'),
  }),
}));

// Mock OTP utility
jest.mock('./utils/otp.util', () => ({
  generateAndStoreOtp: jest.fn().mockResolvedValue(123456),
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

// Mock hashPassword utility
jest.mock('./utils/password.util', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed-password'),
}));

jest.mock('src/common/utils/generate-validate-usernames.util', () => ({
  generateUsernames: jest.fn().mockResolvedValue(['testuser1', 'testuser2', 'testuser3']),
}));

const createMockPrismaService = () => {
  return {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userDevice: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
    },
    profile: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
};

describe('AuthService with mock ConfigService', () => {
  let service: AuthService;
  let mockPrismaService: ReturnType<typeof createMockPrismaService>;
  let mockJwtService: jest.Mocked<Partial<JwtService>>;
  let mockConfigService: jest.Mocked<Partial<ConfigService>>;
  let mockRecaptchaService: { validateToken: jest.Mock };
  let mockEmailQueue: { add: jest.Mock; close: jest.Mock };

  const mockUsersService = {
    findByIdentifier: jest.fn(),
    updatePasswordById: jest.fn(),
    findByEmail: jest.fn(),
    createUser: jest.fn(),
    checkUsernameExistence: jest.fn(),
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

  const mockRefreshTokensService = {
    createRefreshToken: jest.fn().mockResolvedValue({}),
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

  const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

  beforeEach(async () => {
    // Initialize mocks
    mockJwtService = {
      signAsync: jest.fn().mockReturnValue('mockAccessToken'),
    };

    mockRecaptchaService = {
      validateToken: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'dev';
        if (key === 'REFRESH_TOKEN_EXPIRES_IN_DAYS') return 30;
        return null;
      }),
    };

    mockEmailQueue = {
      add: jest.fn(),
      close: jest.fn(),
    };

    mockPrismaService = createMockPrismaService();

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
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    // Mock transaction implementation with proper typing
    mockPrismaService.$transaction.mockImplementation(
      async <T>(callback: TransactionCallback<T>): Promise<T> => {
        return callback(mockPrismaService as never);
      },
    );

    service = module.get<AuthService>(AuthService);
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user when correct password', async () => {
      const fakeUser: Partial<Prisma.UserGetPayload<object>> = {
        id: 100n,
        username: 'username',
        passwordHash: 'hash',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(fakeUser as never);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.validateUser('username', 'password');

      expect(result).not.toBeNull();
    });

    it('should return null when incorrect password', async () => {
      const fakeUser = {
        id: 100n,
        username: 'username',
        passwordHash: 'hash',
      } as never;

      mockPrismaService.user.findFirst.mockResolvedValue(fakeUser);
      mockedBcrypt.compare.mockResolvedValueOnce(false as never);

      const result = await service.validateUser('username', 'password');

      expect(result).toBeNull();
    });

    it("should return null when user doesn't have password_hash", async () => {
      const fakeUser = {
        id: 100n,
        username: 'username',
        passwordHash: undefined,
      } as never;

      mockPrismaService.user.findFirst.mockResolvedValue(fakeUser);

      const result = await service.validateUser('username', 'password');

      expect(result).toBeNull();
    });

    it('cant find user', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.validateUser('username', 'password');

      expect(result).toBeNull();
    });

    it('should call bcrypt.compare with the correct plaintext and hashed passwords', async () => {
      const plainPassword = 'password123';
      const hashedPassword = 'a_very_long_hashed_string';

      const fakeUser = {
        id: 100n,
        username: 'testuser',
        passwordHash: hashedPassword,
      } as never;

      mockPrismaService.user.findFirst.mockResolvedValue(fakeUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      await service.validateUser('testuser', plainPassword);

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(plainPassword, hashedPassword);
    });

    it('should propagate errors from the database', async () => {
      const dbError = new Error('Database connection failed');
      mockPrismaService.user.findFirst.mockRejectedValueOnce(dbError);

      await expect(service.validateUser('testuser', 'password')).rejects.toThrow(dbError);
    });
  });

  describe('login', () => {
    const mockDeviceType = 'Chrome on Windows (Desktop)';
    const ipAddress = '192.33.100.1';
    const user: RequestUser = { id: '1' };
    it('should correctly handle login', async () => {
      const fakeToken = {
        id: 100n,
        tokenHash: 'mockHashedToken',
        expiresAt: new Date(),
      } as never;

      mockPrismaService.refreshToken.create.mockResolvedValue(fakeToken);

      const fakeDevice = {
        id: 100n,
        deviceType: mockDeviceType,
        ipAddress: ipAddress,
      } as never;

      mockPrismaService.userDevice.create.mockResolvedValue(fakeDevice);

      const result = await service.login(user, mockDeviceType, ipAddress);

      expect(result).toEqual({
        accessToken: 'mockAccessToken',
        refreshToken: 'mockRefreshToken',
      });
    });

    it('should throw an error if the database transaction fails', async () => {
      const transactionError = new Error('Transaction failed due to a conflict');
      mockPrismaService.$transaction.mockRejectedValueOnce(transactionError);

      await expect(service.login(user, mockDeviceType, ipAddress)).rejects.toThrow(
        transactionError,
      );
    });

    it('should use default value when REFRESH_TOKEN_EXPIRES_IN_DAYS is not configured', async () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'REFRESH_TOKEN_EXPIRES_IN_DAYS') return null;
        if (key === 'NODE_ENV') return 'dev';
        return null;
      });

      const fakeToken = { id: 100n, tokenHash: 'hash', expiresAt: new Date() } as never;
      const fakeDevice = { id: 100n } as never;

      mockPrismaService.refreshToken.create.mockResolvedValue(fakeToken);
      mockPrismaService.userDevice.create.mockResolvedValue(fakeDevice);

      const result = await service.login(user, mockDeviceType, ipAddress);

      expect(result).toEqual({
        accessToken: 'mockAccessToken',
        refreshToken: 'mockRefreshToken',
      });
    });
  });

  describe('forgotPassword', () => {
    it('should throw USER_NOT_FOUND when user does not exist', async () => {
      mockUsersService.findByIdentifier.mockResolvedValue(null);
      mockRecaptchaService.validateToken.mockResolvedValue(true);

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
      mockRecaptchaService.validateToken.mockResolvedValue(true);
      (generateAndStoreOtp as jest.Mock).mockResolvedValue(undefined);
      (crypto.randomUUID as jest.Mock).mockReturnValue('test-uuid');

      const forgotPasswordDto = { identifier: 'test@gmail.com', recaptchaToken: '' };

      const result = await service.forgotPassword(forgotPasswordDto);

      expect(result).toHaveProperty('confirmationToken');
      expect(result.confirmationToken).toBeTruthy();
      expect(typeof result.confirmationToken).toBe('string');
      expect(mockUsersService.findByIdentifier).toHaveBeenCalledWith(forgotPasswordDto.identifier);

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

    it('should throw error when recaptcha token is invalid', async () => {
      const forgotPasswordDto = {
        identifier: 'test@gmail.com',
        recaptchaToken: 'invalid-token',
      };

      mockUsersService.findByIdentifier.mockResolvedValue({
        id: 1234,
        email: 'test@gmail.com',
      });
      mockRecaptchaService.validateToken.mockResolvedValue(false);

      await expect(service.forgotPassword(forgotPasswordDto)).rejects.toThrow(
        new BadRequestException(
          createValidationError('recaptchaToken', {
            invalidToken: AUTH_ERROR_MESSAGES.INVALID_RECAPTCHA_TOKEN,
          }),
        ),
      );
    });
  });

  describe('verifyForgotPassword', () => {
    const mockConfirmationToken = 'test-token';

    it('should verify OTP and update redis when OTP is valid', async () => {
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockRedisService.get.mockResolvedValue(JSON.stringify(mockPasswordResetData));

      const mockVerifyForgotPasswordDto = {
        otp: '123456',
        confirmationToken: mockConfirmationToken,
      };

      const result = await service.verifyForgotPassword(mockVerifyForgotPasswordDto);

      expect(result).toEqual({ message: 'Password reset verified successfully.' });
      expect(mockRedisService.set).toHaveBeenCalledWith(
        REDIS_KEYS.PASSWORD_RESET(mockConfirmationToken),
        expect.stringContaining('"verified":true'),
        expect.any(Number),
      );
    });

    it('should throw INVALID_TOKEN when redis data does not exist', async () => {
      mockRedisService.get.mockResolvedValue(null);

      const mockVerifyForgotPasswordDto = {
        otp: '123456',
        confirmationToken: mockConfirmationToken,
      };

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

      mockUsersService.findByEmail.mockResolvedValue(null);
      mockRecaptchaService.validateToken.mockResolvedValue(true);
      (crypto.randomUUID as jest.Mock).mockReturnValue('test-uuid');

      const result = await service.startRegistration(startRegistrationDto);

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

      mockRecaptchaService.validateToken.mockResolvedValue(true);
      mockUsersService.findByEmail.mockResolvedValue({ id: 1 });

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

      mockUsersService.findByEmail.mockResolvedValue(null);
      mockRecaptchaService.validateToken.mockResolvedValue(true);
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

      await expect(service.startRegistration(startRegistrationDto)).rejects.toThrow(HttpException);
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
    const mockConfirmationToken = 'test-token';

    it('should successfully verify a correct OTP', async () => {
      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedData));
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.verifyOtp(dto);

      expect(result).toEqual({ message: 'OTP verified successfully' });
      const expectedUpdatedData = { ...cachedData, verified: true };
      expect(mockRedisService.set).toHaveBeenCalledWith(
        REDIS_KEYS.REGISTRATION(dto.creationToken),
        JSON.stringify(expectedUpdatedData),
        AUTH_CONFIG.REGISTRATION_TTL,
      );
    });

    it('should throw an error for an invalid creation token', async () => {
      mockRedisService.get.mockResolvedValue(null);

      await expect(service.verifyOtp(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw OTP_INVALID when OTP does not match', async () => {
      mockedBcrypt.compare.mockResolvedValue(false as never);
      mockRedisService.get.mockResolvedValue(JSON.stringify(mockPasswordResetData));

      const mockVerifyForgotPasswordDto = {
        otp: '000000',
        confirmationToken: mockConfirmationToken,
      };

      await expect(service.verifyForgotPassword(mockVerifyForgotPasswordDto)).rejects.toThrow(
        new BadRequestException(
          createValidationError('otp', {
            invalidToken: AUTH_ERROR_MESSAGES.OTP_INVALID,
          }),
        ),
      );
    });

    it('should throw OTP_NOT_VERIFIED when OTP has not been verified', async () => {
      mockRedisService.get.mockResolvedValue(
        JSON.stringify({ ...mockPasswordResetData, verified: false }),
      );

      const mockResetPasswordDto = {
        confirmationToken: mockConfirmationToken,
        newPassword: 'NewPassword1!',
      };

      await expect(service.resetPassword(mockResetPasswordDto)).rejects.toThrow(
        new BadRequestException(
          createValidationError('confirmationToken', {
            invalidToken: AUTH_ERROR_MESSAGES.OTP_NOT_VERIFIED,
          }),
        ),
      );
    });

    it('should throw an error for an incorrect OTP', async () => {
      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedData));
      mockedBcrypt.compare.mockResolvedValue(false as never);

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
    const mockConfirmationToken = 'test-token';

    it('should update password, remove devices, and cleanup redis when verified', async () => {
      mockRedisService.get.mockResolvedValue(
        JSON.stringify({ ...mockPasswordResetData, verified: true }),
      );

      const mockResetPasswordDto = {
        confirmationToken: mockConfirmationToken,
        newPassword: 'NewPassword1!',
      };

      const result = await service.resetPassword(mockResetPasswordDto);

      expect(result).toEqual({ message: 'Password has been reset successfully.' });

      expect(mockUsersService.updatePasswordById).toHaveBeenCalledWith(
        BigInt(mockPasswordResetData.userId),
        'hashed-password',
      );

      expect(mockDevicesService.removeAllUserDevices).toHaveBeenCalledWith(
        BigInt(mockPasswordResetData.userId),
      );

      expect(mockRedisService.del).toHaveBeenCalledWith(
        REDIS_KEYS.PASSWORD_RESET(mockConfirmationToken),
      );
    });

    it('should throw INVALID_CONFIRMATION_TOKEN when redis data does not exist', async () => {
      mockRedisService.get.mockResolvedValue(null);

      const mockResetPasswordDto = {
        confirmationToken: mockConfirmationToken,
        newPassword: 'NewPassword1!',
      };

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
    const dto = { creationToken: 'test-token', password: 'Password1!' };
    const cachedData: CachedRegistrationData = {
      email: 'test@email.com',
      name: 'Test',
      birthDate: new Date(),
      otp: 'hashed-otp',
      verified: true,
    };
    const deviceType = 'Chrome on Windows (Desktop)';

    it('should successfully complete the registration', async () => {
      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedData));
      mockJwtService.signAsync = jest.fn().mockResolvedValue('access-token');

      const mockUserId = BigInt(123);
      const mockDeviceId = BigInt(456);

      mockUsersService.createUser.mockResolvedValue({ id: mockUserId });
      mockDevicesService.createDevice.mockResolvedValue({ id: mockDeviceId });
      mockRefreshTokensService.createRefreshToken.mockResolvedValue({});

      const mockTx = {
        profile: {
          create: jest.fn().mockResolvedValue({ id: 1 }),
        },
      };

      mockPrismaService.$transaction.mockImplementationOnce(((
        callback: TransactionCallback<unknown>,
      ) => {
        return callback(mockTx as never);
      }) as never);

      const result = await service.completeRegistration(dto, '127.0.0.1', deviceType);

      expect(result.message).toBe('Registration completed successfully');
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('mockRefreshToken');
      expect(mockRedisService.del).toHaveBeenCalledWith(REDIS_KEYS.REGISTRATION(dto.creationToken));
      expect(mockRedisService.del).toHaveBeenCalledWith(REDIS_KEYS.OTP_RESEND(cachedData.email));
    });

    it('should throw an error if OTP was not verified first', async () => {
      const unverifiedData = { ...cachedData, verified: false };
      mockRedisService.get.mockResolvedValue(JSON.stringify(unverifiedData));

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
        BadRequestException,
      );
    });
  });

  describe('resendPasswordOtp', () => {
    it('should call generateAndStoreOtp to resend OTP', async () => {
      mockRedisService.get.mockResolvedValue(JSON.stringify(mockPasswordResetData));
      (generateAndStoreOtp as jest.Mock).mockResolvedValue(undefined);

      const result = await service.resendPasswordOtp({ confirmationToken: 'test-token' });

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
          redisKey: REDIS_KEYS.PASSWORD_RESET('test-token'),
          resendKey: REDIS_KEYS.OTP_RESEND_PASSWORD_RESET(mockPasswordResetData.email),
          ttl: AUTH_CONFIG.PASSWORD_RESET_TTL,
        }),
        mockRedisService,
      );
    });

    it('should throw INVALID_TOKEN when redis data does not exist', async () => {
      mockRedisService.get.mockResolvedValue(null);

      await expect(service.resendPasswordOtp({ confirmationToken: 'test-token' })).rejects.toThrow(
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
      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedData));
      (generateAndStoreOtp as jest.Mock).mockResolvedValue(undefined);

      const result = await service.resendOtp(creationToken);

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

      await expect(service.resendOtp(creationToken)).rejects.toThrow(BadRequestException);
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

  describe('checkUsername', () => {
    it('should return { message and exists: true } if username is taken by another user', async () => {
      const existingUser = {
        id: BigInt(2),
        email: 'other@example.com',
        username: 'takenusername',
        password_hash: 'hash',
      };
      mockUsersService.checkUsernameExistence.mockResolvedValue(existingUser);

      const result = await service.checkUsername('1', 'takenusername');

      expect(result).toStrictEqual({
        message: 'Username already exists',
        exists: true,
      });
      expect(mockUsersService.checkUsernameExistence).toHaveBeenCalledWith('1', 'takenusername');
    });

    it('should return { message and exists: false } if username is available', async () => {
      mockUsersService.checkUsernameExistence.mockResolvedValue(null);

      const result = await service.checkUsername('1', 'availableusername');

      expect(result).toStrictEqual({
        message: 'Username is available',
        exists: false,
      });
      expect(mockUsersService.checkUsernameExistence).toHaveBeenCalledWith(
        '1',
        'availableusername',
      );
    });

    it('should return { message and exists: false } for same username (case-sensitive match)', async () => {
      mockUsersService.checkUsernameExistence.mockResolvedValue(null);

      const result = await service.checkUsername('1', 'currentusername');

      expect(result).toStrictEqual({
        message: 'Username is available',
        exists: false,
      });
    });

    it('should return { message and exists: false } for case-only change of own username', async () => {
      mockUsersService.checkUsernameExistence.mockResolvedValue(null);

      const result = await service.checkUsername('1', 'CurrentUsername');

      expect(result).toStrictEqual({
        message: 'Username is available',
        exists: false,
      });
    });

    it('should return { message and exists: true } for case variation of another users username', async () => {
      const existingUser = {
        id: BigInt(2),
        email: 'john@example.com',
        username: 'johndoe',
        password_hash: 'hash',
      };
      mockUsersService.checkUsernameExistence.mockResolvedValue(existingUser);

      const result = await service.checkUsername('1', 'JohnDoe');

      expect(result).toStrictEqual({
        message: 'Username already exists',
        exists: true,
      });
    });

    it('should handle special characters in username', async () => {
      mockUsersService.checkUsernameExistence.mockResolvedValue(null);

      const result = await service.checkUsername('1', 'user_123');

      expect(result).toStrictEqual({
        message: 'Username is available',
        exists: false,
      });
    });
  });

  describe('verifyRecaptcha', () => {
    it('should return true if the token is valid', async () => {
      mockRecaptchaService.validateToken.mockResolvedValue(true);
      const result = await service.verifyRecaptcha('valid-token');
      expect(result).toBe(true);
      expect(mockRecaptchaService.validateToken).toHaveBeenCalledWith('valid-token');
    });

    it('should return false if the token is invalid', async () => {
      mockRecaptchaService.validateToken.mockResolvedValue(false);
      const result = await service.verifyRecaptcha('invalid-token');
      expect(result).toBe(false);
      expect(mockRecaptchaService.validateToken).toHaveBeenCalledWith('invalid-token');
    });
  });

  describe('checkIdentifier', () => {
    const user = { id: '1', username: 'testuser', phone: 'mockedPhone', email: 'mockedEmail' };

    it('should return exist true when user found with username', async () => {
      const fakeUser = { id: BigInt(user.id), username: user.username } as never;
      mockPrismaService.user.findFirst.mockResolvedValue(fakeUser);

      const result = await service.checkIdentifier(user.username);

      expect(result).toEqual({
        exists: true,
        type: 'username',
      });
    });

    it('should return exist true when user found with email', async () => {
      const fakeUser = { id: BigInt(user.id), email: user.email } as never;
      mockPrismaService.user.findFirst.mockResolvedValue(fakeUser);

      const result = await service.checkIdentifier(user.email);

      expect(result).toEqual({
        exists: true,
        type: 'email',
      });
    });

    it('should return exist false when user not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.checkIdentifier('someusername');

      expect(result).toEqual({
        exists: false,
      });
    });
  });

  describe('generateAccessToken', () => {
    it('should generate a valid access token with userId', async () => {
      const userId = BigInt(12345);
      const expectedToken = 'mock-jwt-token';

      mockJwtService.signAsync = jest.fn().mockResolvedValue(expectedToken);

      const result = await mockJwtService.signAsync({ id: userId.toString() });

      expect(result).toBe(expectedToken);
      expect(mockJwtService.signAsync).toHaveBeenCalledWith({
        id: userId.toString(),
      });
    });

    it('should handle bigint userId correctly', async () => {
      const userId = BigInt('999999999999999999');
      const expectedToken = 'mock-jwt-token';

      mockJwtService.signAsync = jest.fn().mockResolvedValue(expectedToken);

      const result = await mockJwtService.signAsync({ id: userId.toString() });

      expect(result).toBe(expectedToken);
      expect(mockJwtService.signAsync).toHaveBeenCalledWith({
        id: '999999999999999999',
      });
    });
  });

  describe('createUserAndDeviceAndToken (private method)', () => {
    const mockNewUser = {
      email: 'test@example.com',
      username: 'test@example.com',
      name: 'Test User',
      passwordHash: 'hashed-password',
      birthDate: new Date('2000-01-01'),
      languageCode: 'EN' as LanguageCode,
    };

    const mockNewDevice = {
      userId: BigInt(0),
      ipAddress: '127.0.0.1',
      deviceType: 'Chrome on Windows (Desktop)',
    };

    const mockRefreshToken = {
      userId: BigInt(0),
      deviceId: BigInt(0),
      tokenHash: 'token-hash',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    it('should create user, profile, device and refresh token in a transaction', async () => {
      const mockUserId = BigInt(123);
      const mockDeviceId = BigInt(456);

      mockUsersService.createUser.mockResolvedValue({ id: mockUserId });
      mockDevicesService.createDevice.mockResolvedValue({ id: mockDeviceId });
      mockRefreshTokensService.createRefreshToken.mockResolvedValue({});
      mockPrismaService.profile.create.mockResolvedValue({ id: 1 } as never);

      // Mock the transaction to execute the callback immediately
      mockPrismaService.$transaction.mockImplementation(
        async <T>(callback: TransactionCallback<T>): Promise<T> => {
          return callback(mockPrismaService as never);
        },
      );

      const result = await service['createUserAndDeviceAndToken'](
        mockNewUser,
        mockNewDevice,
        mockRefreshToken,
      );

      expect(result).toBe(mockUserId);
      const { $transaction } = mockPrismaService;
      expect($transaction).toHaveBeenCalledTimes(1);
      expect(mockUsersService.createUser).toHaveBeenCalledWith(mockNewUser, mockPrismaService);
      expect(mockPrismaService.profile.create).toHaveBeenCalledWith({
        data: { userId: mockUserId, displayName: mockNewUser.name },
      });
      expect(mockDevicesService.createDevice).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          ipAddress: mockNewDevice.ipAddress,
          deviceType: mockNewDevice.deviceType,
        }),
        mockPrismaService,
      );
      expect(mockRefreshTokensService.createRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          deviceId: mockDeviceId,
          tokenHash: mockRefreshToken.tokenHash,
          expiresAt: mockRefreshToken.expiresAt,
        }),
        mockPrismaService,
      );
    });

    it('should update device and refresh token with correct user and device IDs', async () => {
      const mockUserId = BigInt(999);
      const mockDeviceId = BigInt(888);

      mockUsersService.createUser.mockResolvedValue({ id: mockUserId });
      mockDevicesService.createDevice.mockResolvedValue({ id: mockDeviceId });
      mockRefreshTokensService.createRefreshToken.mockResolvedValue({});
      mockPrismaService.profile.create.mockResolvedValue({ id: 1 } as never);

      mockPrismaService.$transaction.mockImplementation(
        async <T>(callback: TransactionCallback<T>): Promise<T> => {
          return callback(mockPrismaService as never);
        },
      );

      await service['createUserAndDeviceAndToken'](mockNewUser, mockNewDevice, mockRefreshToken);

      expect(mockDevicesService.createDevice).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
        }),
        mockPrismaService,
      );

      expect(mockRefreshTokensService.createRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          deviceId: mockDeviceId,
        }),
        mockPrismaService,
      );
    });

    it('should create profile with correct display name from user name', async () => {
      const mockUserId = BigInt(100);
      const mockDeviceId = BigInt(200);

      mockUsersService.createUser.mockResolvedValue({ id: mockUserId });
      mockDevicesService.createDevice.mockResolvedValue({ id: mockDeviceId });
      mockRefreshTokensService.createRefreshToken.mockResolvedValue({});
      mockPrismaService.profile.create.mockResolvedValue({ id: 1 } as never);

      mockPrismaService.$transaction.mockImplementation(
        async <T>(callback: TransactionCallback<T>): Promise<T> => {
          return callback(mockPrismaService as never);
        },
      );

      const customUser = {
        ...mockNewUser,
        name: 'Custom Display Name',
      };

      await service['createUserAndDeviceAndToken'](customUser, mockNewDevice, mockRefreshToken);

      expect(mockPrismaService.profile.create).toHaveBeenCalledWith({
        data: { userId: mockUserId, displayName: 'Custom Display Name' },
      });
    });
  });

  describe('checkIdentifier', () => {
    const user = { id: '1', username: 'testuser', phone: 'mockedPhone', email: 'mockedEmail' };

    it('should return exist true when user found with username', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: user.id,
        username: user.username,
      });

      const result = await service.checkIdentifier(user.username);

      expect(result).toEqual({
        exists: true,
        type: 'username',
      });
    });

    it('should return exist true when user found with email', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: user.id,
        email: user.email,
      });

      const result = await service.checkIdentifier(user.email);

      expect(result).toEqual({
        exists: true,
        type: 'email',
      });
    });

    it('should return exist true when user found with phone', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: user.id,
        phone: user.phone,
      });

      const result = await service.checkIdentifier(user.phone);

      expect(result).toEqual({
        exists: true,
        type: 'phone',
      });
    });

    it('should return exist false when user not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.checkIdentifier('someusername');

      expect(result).toEqual({
        exists: false,
      });
    });
  });
  describe('refrehAccessToken', () => {
    it('should validate old token and return new accessToken and refreshToken', async () => {
      const oldToken = 'oldRefreshToken';
      const date = new Date();
      date.setDate(date.getDate() + 1);
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        id: '100',
        user: { id: BigInt('100'), username: 'username' },
        expiresAt: date,
      });
      const result = await service.refreshAccessToken(oldToken);

      expect(result).toEqual({
        refreshToken: 'mockRefreshToken',
        accessToken: 'mockAccessToken',
      });
    });
    it('should throw UnauthorizedException if token not found', async () => {
      const oldToken = 'oldRefreshToken';
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshAccessToken(oldToken)).rejects.toThrow(UnauthorizedException);
    });
    it('should throw UnauthorizedException if token expired', async () => {
      const oldToken = 'oldRefreshToken';
      const date = new Date();
      date.setDate(date.getDate() - 1);
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        expiresAt: date,
      });

      await expect(service.refreshAccessToken(oldToken)).rejects.toThrow(UnauthorizedException);
    });
  });
  describe('clearRefreshToken', () => {
    const oldToken = 'oldRefreshToken';

    const user: RequestUser = { id: '200' };
    it('should call prisma $transaction', async () => {
      mockPrismaService.$transaction.mockImplementation(
        async <T>(arg: TransactionCallback<T> | unknown[]): Promise<T | unknown[]> => {
          if (typeof arg === 'function') {
            return arg(mockPrismaService as never);
          }

          if (Array.isArray(arg)) {
            return Promise.resolve(arg.map(() => ({ count: 1 })));
          }

          throw new Error('Invalid $transaction argument');
        },
      );
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        id: '100',
        user: { id: BigInt('100'), username: 'username' },
        deviceId: '1000',
      });
      await service.clearRefreshToken(user.id, oldToken);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });
});
