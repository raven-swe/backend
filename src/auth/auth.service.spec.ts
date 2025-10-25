import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { BadRequestException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { UsersService } from 'src/users/users.service';
import { RecaptchaService } from 'src/recaptcha/recaptcha.service';
import { DevicesService } from 'src/device/device.service';
import { RefreshTokensService } from 'src/refresh-tokens/refresh-tokens.service';
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
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { RequestUser } from './types';

jest.mock('bcrypt');

jest.mock('crypto', () => ({
  randomUUID: jest.fn(),
  randomBytes: () => ({
    toString: () => 'mockRefreshToken',
  }),
  createHash: () => {
    const hash = {
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mockHashedToken'),
    };
    return hash;
  },
}));

jest.mock('./utils/otp.util', () => ({
  generateAndStoreOtp: jest.fn().mockResolvedValue(123456),
}));

// Mock the dependencies
let mockPrismaService: DeepMockProxy<PrismaService>;

jest.mock('bcrypt', () => ({
  hash: () => Promise.resolve('mockHashedToken'),
  compare: jest.fn(() => Promise.resolve(true)),
}));

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService with mock ConfigService', () => {
  let service: AuthService;
  let mockRedisService: Partial<RedisService>;
  let mockUsersService: Partial<UsersService>;
  let mockJwtService: Partial<JwtService>;
  let mockRecaptchaService: Partial<RecaptchaService>;
  let mockDeviceService: Partial<DevicesService>;
  let mockRefreshTokensService: Partial<RefreshTokensService>;
  let mockEmailQueue: { add: jest.Mock };
  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'NODE_ENV') return 'dev';
      if (key === 'REFRESH_TOKEN_EXPIRES_IN_DAYS') return 30;
      return null;
    }),
  };

  beforeEach(async () => {
    mockUsersService = {
      findByEmail: jest.fn(),
      createUser: jest.fn(),
    };
    mockJwtService = {
      signAsync: jest.fn(),
      sign: jest.fn().mockReturnValue('mockAccessToken'),
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
    mockPrismaService = mockDeep<PrismaService>();
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
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    mockPrismaService.$transaction.mockImplementation((async (
      callback: (tx: typeof mockPrismaService) => Promise<unknown>,
    ): Promise<unknown> => {
      return await callback(mockPrismaService);
    }) as any);

    service = module.get<AuthService>(AuthService);
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user when correct password', async () => {
      const fakeUser = {
        id: 100n,
        username: 'username',
        password_hash: 'hash',
      } as Partial<any>;

      mockPrismaService.users.findFirst.mockResolvedValue(fakeUser as any);

      const body = { identifier: 'username', password: 'password' };
      const result = await service.validateUser(body.identifier, body.password);

      expect(result).not.toBeNull();
    });

    it('should return null when incorrect password', async () => {
      const fakeUser = {
        id: 100n,
        username: 'username',
        password_hash: 'hash',
      } as Partial<any>;

      mockPrismaService.users.findFirst.mockResolvedValue(fakeUser as any);
      mockedBcrypt.compare.mockResolvedValueOnce(false as never);

      const body = { identifier: 'username', password: 'password' };
      const result = await service.validateUser(body.identifier, body.password);

      expect(result).toBeNull();
    });

    it("should return null when user doesn't have password_hash", async () => {
      const fakeUser = {
        id: 100n,
        username: 'username',
        password_hash: undefined,
      } as Partial<any>;

      mockPrismaService.users.findFirst.mockResolvedValue(fakeUser as any);

      const body = { identifier: 'username', password: 'password' };
      const result = await service.validateUser(body.identifier, body.password);

      expect(result).toBeNull();
    });

    it('cant find user', async () => {
      mockPrismaService.users.findFirst.mockResolvedValue(null);

      const body = { identifier: 'username', password: 'password' };
      const result = await service.validateUser(body.identifier, body.password);

      expect(result).toBeNull();
    });

    it('should call bcrypt.compare with the correct plaintext and hashed passwords', async () => {
      const plainPassword = 'password123';
      const hashedPassword = 'a_very_long_hashed_string';

      const fakeUser = {
        id: 100n,
        username: 'testuser',
        password_hash: hashedPassword,
      } as Partial<any>;

      mockPrismaService.users.findFirst.mockResolvedValue(fakeUser as any);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      await service.validateUser('testuser', plainPassword);

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(plainPassword, hashedPassword);
    });

    it('should propagate errors from the database', async () => {
      const dbError = new Error('Database connection failed');
      mockPrismaService.users.findFirst.mockRejectedValueOnce(dbError);

      await expect(service.validateUser('testuser', 'password')).rejects.toThrow(dbError);
    });
  });

  describe('login', () => {
    const mockDeviceType = 'Chrome on Windows (Desktop)';
    const ipAddress = '192.33.100.1';
    const user: RequestUser = { id: '1', username: 'testuser' };
    it('should correctly handle login', async () => {
      const fakeToken = {
        id: 100n,
        token_hash: 'mockHashedToken',
        expires_at: 'expires_at',
      } as Partial<any>;

      mockPrismaService.refresh_tokens.create.mockResolvedValue(fakeToken as any);

      const fakeDevice = {
        id: 100n,
        device_type: mockDeviceType,
        ip_address: ipAddress,
      } as Partial<any>;

      mockPrismaService.user_devices.create.mockResolvedValue(fakeDevice as any);

      const result = await service.login(user, mockDeviceType, ipAddress);

      expect(result).toEqual({
        accessToken: 'mockAccessToken',
        refreshToken: 'mockRefreshToken',
      });

      type RefreshTokenCreateInput = {
        data: {
          user_id: bigint;
          token_hash: string;
          device_id: string;
          expires_at: Date;
        };
      };

      const calls = mockPrismaService.refresh_tokens.create.mock.calls as unknown as [
        RefreshTokenCreateInput,
      ][];

      const call = calls[0][0];

      expect(call.data.user_id).toBe(BigInt(user.id));
      expect(call.data.token_hash).toBe('mockHashedToken');
      expect(call.data.device_id).toBe(100n);
      expect(call.data.expires_at).toBeInstanceOf(Date);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockPrismaService.user_devices.create).toHaveBeenCalledWith({
        data: {
          user_id: BigInt(user.id),
          device_type: mockDeviceType,
          ip_address: ipAddress,
        },
      });

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        id: user.id,
        username: user.username,
      });
    });

    it('should throw an error if the database transaction fails', async () => {
      const transactionError = new Error('Transaction failed due to a conflict');
      mockPrismaService.$transaction.mockRejectedValueOnce(transactionError);

      await expect(service.login(user, mockDeviceType, ipAddress)).rejects.toThrow(
        transactionError,
      );
    });

    it('should use default value for mockService when not assigned', async () => {
      mockConfigService.get.mockImplementationOnce((key: string) => {
        if (key === 'REFRESH_TOKEN_EXPIRES_IN_DAYS') {
          return null;
        }
        return 'dev';
      });

      const fakeToken = {} as Partial<any>;
      const fakeDevice = { id: 100n } as Partial<any>;
      mockPrismaService.refresh_tokens.create.mockResolvedValue(fakeToken as any);

      mockPrismaService.user_devices.create.mockResolvedValue(fakeDevice as any);

      const result = await service.login(user, mockDeviceType, ipAddress);

      expect(result).toEqual({
        accessToken: 'mockAccessToken',
        refreshToken: 'mockRefreshToken',
      });
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
      expect(result.refreshToken).toBe('mockRefreshToken');
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

  describe('checkIdentifier', () => {
    const user = { id: '1', username: 'testuser', phone: 'mockedPhone', email: 'mockedEmail' };

    it('should return exist true when user found with username', async () => {
      const fakeUser = { id: BigInt(user.id), username: user.username } as Partial<any>;
      mockPrismaService.users.findFirst.mockResolvedValue(fakeUser as any);

      const result = await service.checkIdentifier(user.username);

      expect(result).toEqual({
        exists: true,
        type: 'username',
      });
    });

    it('should return exist true when user found with email', async () => {
      const fakeUser = { id: BigInt(user.id), email: user.email } as Partial<any>;
      mockPrismaService.users.findFirst.mockResolvedValue(fakeUser as any);

      const result = await service.checkIdentifier(user.email);

      expect(result).toEqual({
        exists: true,
        type: 'email',
      });
    });

    it('should return exist false when user not found', async () => {
      mockPrismaService.users.findFirst.mockResolvedValue(null);

      const result = await service.checkIdentifier('someusername');

      expect(result).toEqual({
        exists: false,
      });
    });
  });
});
