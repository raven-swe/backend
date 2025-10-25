import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { BadRequestException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RecaptchaService } from 'src/recaptcha/recaptcha.service';
import { DevicesService } from 'src/device/device.service';
import { RefreshTokensService } from 'src/refresh-tokens/refresh-tokens.service';
import { PrismaService } from 'src/prisma/prisma.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { generateAndStoreOtp } from './utils/otp.util';
import {
  AUTH_CONFIG,
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
  REDIS_KEYS,
} from 'src/common/constants/auth.constants';
import { OtpType } from 'src/email/interfaces/email.interfaces';
import { getQueueToken } from '@nestjs/bullmq';
import { CachedRegistrationData } from './interfaces/CachedRegistrationData.interface';
import { DeviceType } from 'src/device/interfaces/device.interface';
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

describe('AuthService', () => {
  let service: AuthService;
  let mockRedisService: Partial<RedisService>;
  let mockUsersService: Partial<UsersService>;
  let mockJwtService: Partial<JwtService>;
  let mockRecaptchaService: Partial<RecaptchaService>;
  let mockDeviceService: Partial<DevicesService>;
  let mockRefreshTokensService: Partial<RefreshTokensService>;
  let mockEmailQueue: { add: jest.Mock };
  let mockPrismaService: Partial<PrismaService>;

  beforeEach(async () => {
    mockUsersService = {
      findByEmail: jest.fn(),
      createUser: jest.fn(),
    };
    mockJwtService = {
      signAsync: jest.fn(),
    };
    mockRecaptchaService = {
      validateToken: jest.fn(),
    };
    mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      ttl: jest.fn().mockResolvedValue(AUTH_CONFIG.OTP_RESEND_WINDOW),
    };
    mockDeviceService = {
      createDevice: jest.fn(),
    };
    mockRefreshTokensService = {
      createRefreshToken: jest.fn(),
    };
    mockEmailQueue = { add: jest.fn() };
    mockPrismaService = {
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        Logger,
        { provide: RedisService, useValue: mockRedisService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: RecaptchaService, useValue: mockRecaptchaService },
        { provide: DevicesService, useValue: mockDeviceService },
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

  it('should be defined', () => {
    expect(service).toBeDefined();
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
      (mockUsersService.findByEmail as jest.Mock).mockResolvedValue(null);
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
      (mockUsersService.findByEmail as jest.Mock).mockResolvedValue({ id: 1 });

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
      (mockUsersService.findByEmail as jest.Mock).mockResolvedValue(null);
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

    it('should successfully verify a correct OTP', async () => {
      (mockRedisService.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));
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
      (mockRedisService.get as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.verifyOtp(dto)).rejects.toThrow(
        new BadRequestException(
          createValidationError('recaptchaToken', {
            invalidToken: AUTH_ERROR_MESSAGES.INVALID_RECAPTCHA_TOKEN,
          }),
        ),
      );
    });

    it('should throw an error for an incorrect OTP', async () => {
      // Arrange
      (mockRedisService.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));
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
      (mockRedisService.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));
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
      (mockRedisService.get as jest.Mock).mockResolvedValue(JSON.stringify(unverifiedData));

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
      (mockRedisService.get as jest.Mock).mockResolvedValue(null);
      await expect(service.completeRegistration(dto, 'string', deviceType)).rejects.toThrow(
        new BadRequestException(
          createValidationError('recaptchaToken', {
            invalidToken: AUTH_ERROR_MESSAGES.INVALID_RECAPTCHA_TOKEN,
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
      (mockRedisService.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));
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
      (mockRedisService.get as jest.Mock).mockResolvedValue(null);

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
      (mockUsersService.findByEmail as jest.Mock).mockResolvedValue({ id: 1 });
      const result = await service.checkEmail('exists@example.com');
      expect(result).toStrictEqual({
        message: 'Email already exists',
        exists: true,
      });
    });

    it('should return { a message and exists: false } if an email is not found', async () => {
      (mockUsersService.findByEmail as jest.Mock).mockResolvedValue(null);
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
