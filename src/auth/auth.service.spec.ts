import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RecaptchaService } from 'src/recaptcha/recaptcha.service';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DevicesService } from 'src/devices/devices.service';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from 'src/common/constants/auth.constants';
import { OtpType } from 'src/email/email.service';

describe('AuthService', () => {
  let service: AuthService;
  let redisService: RedisService;
  let usersService: UsersService;
  let devicesService: DevicesService;
  let emailQueue: Queue;

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

  const mockGenerateAndStoreOtp = jest.fn().mockResolvedValue('123456');
  jest.mock('./utils/otp.util', () => ({
    generateAndStoreOtp: mockGenerateAndStoreOtp,
  }));

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        BullModule.registerQueue({
          name: 'email',
        }),
      ],
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
    usersService = module.get<UsersService>(UsersService);
    devicesService = module.get<DevicesService>(DevicesService);
    emailQueue = module.get(getQueueToken('email'));
  });

  afterAll(async () => {
    await emailQueue.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('forgotPassword', () => {
    it('should throw USER_NOT_FOUND when exception does not exist', async () => {
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

    it('should generate OTP and send via email when user exists', async () => {
      mockUsersService.findByIdentifier.mockResolvedValue(mockUser);
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(true);
      mockEmailQueue.add.mockResolvedValue({});

      const forgotPasswordDto = { identifier: 'test@gmail.com', recaptchaToken: '' };

      const result = await service.forgotPassword(forgotPasswordDto);

      expect(result).toHaveProperty('confirmationToken');
      expect(result.confirmationToken).toBeTruthy();
      expect(mockUsersService.findByIdentifier).toHaveBeenCalledWith(forgotPasswordDto.identifier);
      expect(mockEmailQueue.add).toHaveBeenCalled();
    });

    it('should queue email job with FORGOT_PASSWORD type', async () => {
      mockUsersService.findByIdentifier.mockResolvedValue(mockUser);
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(true);
      mockEmailQueue.add.mockResolvedValue({});

      const forgotPasswordDto = { identifier: mockUser.email, recaptchaToken: '' };

      await service.forgotPassword(forgotPasswordDto);

      expect(mockEmailQueue.add).toHaveBeenCalledWith(
        'sendOtp',
        expect.objectContaining({
          type: OtpType.FORGOT_PASSWORD,
          email: mockUser.email,
        }),
      );
    });
  });
});
