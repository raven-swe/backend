import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RecaptchaService } from 'src/recaptcha/recaptcha.service';
import { getQueueToken } from '@nestjs/bullmq';
import { DevicesService } from 'src/device/device.service';
import { RefreshTokensService } from 'src/refresh-tokens/refresh-tokens.service';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

jest.mock('bcrypt');
jest.mock('crypto', () => ({
  randomUUID: jest.fn(),
  randomInt: jest.fn(),
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(),
  }),
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
    };
    mockDeviceService = {
      createDevice: jest.fn(),
    };
    mockRefreshTokensService = {
      createRefreshToken: jest.fn(),
    };
    mockEmailQueue = {
      add: jest.fn(),
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

      // arrange
      (mockUsersService.findByEmail as jest.Mock).mockResolvedValue(null);
      (mockRedisService.get as jest.Mock).mockResolvedValue(null);
      (mockRedisService.set as jest.Mock).mockResolvedValue(undefined);
      (crypto.randomUUID as jest.Mock).mockReturnValue('test-uuid');
      (crypto.randomInt as jest.Mock).mockReturnValue(123456);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-otp');

      // act
      const result = await service.startRegistration(startRegistrationDto);

      // assert
      expect(result).toEqual({
        creationToken: 'test-uuid',
      });

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(startRegistrationDto.email);
      expect(mockEmailQueue.add).toHaveBeenCalledWith('sendOtp', {
        email: startRegistrationDto.email,
        otp: '123456',
      });
      expect(mockRedisService.set).toHaveBeenCalledTimes(2); // registration data and resend count (by email)
      expect(mockRedisService.set).toHaveBeenCalledWith(
        `registration:test-uuid`,
        expect.any(String),
        service['registrationTTL'],
      );
      expect(mockRedisService.set).toHaveBeenCalledWith(
        `otp_resend:${startRegistrationDto.email}`,
        '1',
        service['otpResendWindow'],
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
    (mockRedisService.get as jest.Mock).mockResolvedValue(String(service['otpResendLimit']));

    // act & assert
    await expect(service.startRegistration(startRegistrationDto)).rejects.toEqual(
      new HttpException(
        'OTP resend limit reached. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );
    expect(mockUsersService.findByEmail).toHaveBeenCalledWith(startRegistrationDto.email);
    expect(mockRedisService.get).toHaveBeenCalledWith(`otp_resend:${startRegistrationDto.email}`);
  });
});
