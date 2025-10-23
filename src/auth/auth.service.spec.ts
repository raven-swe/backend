import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RecaptchaService } from 'src/recaptcha/recaptcha.service';
import { DevicesService } from 'src/device/device.service';
import { RefreshTokensService } from 'src/refresh-tokens/refresh-tokens.service';
import { PrismaService } from 'src/prisma/prisma.service';
import * as crypto from 'crypto';
import { generateAndStoreOtp } from './utils/otp.util';
import {
  AUTH_CONFIG,
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
  REDIS_KEYS,
} from 'src/common/constants/auth.constants';
import { OtpType } from 'src/email/interfaces/email.interfaces';
import { getQueueToken } from '@nestjs/bullmq';

jest.mock('crypto', () => ({
  randomUUID: jest.fn(),
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
    mockRedisService = {};
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
    (generateAndStoreOtp as jest.Mock).mockRejectedValue(
      new HttpException(
        {
          message: AUTH_ERROR_MESSAGES.OTP_RESEND_LIMIT_EXCEEDED,
          code: AUTH_ERROR_CODES.OTP_RESEND_LIMIT_EXCEEDED,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );

    // act & assert
    await expect(service.startRegistration(startRegistrationDto)).rejects.toEqual(
      new HttpException(
        'OTP resend limit reached. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );
    expect(mockUsersService.findByEmail).toHaveBeenCalledWith(startRegistrationDto.email);
  });
});
