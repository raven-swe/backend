import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { UsersService } from 'src/users/users.service';
import { RedisService } from 'src/redis/redis.service';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { InititateEmailUpdateDto } from 'src/users/dtos/initiate-email-update.dto';
import { VerifyEmailUpdateDto } from 'src/users/dtos/verify-email-update.dto';
import { ResendEmailUpdateOtp } from 'src/users/dtos/resend-email-update-otp.dto';
import { USERS_ERROR_CODES, USERS_ERROR_MESSAGES } from 'src/common/constants/users.constants';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from 'src/auth/constants/auth.constants';
import { OtpType } from 'src/email/interfaces/email.interfaces';
import * as bcrypt from 'bcrypt';
import * as otpUtil from 'src/auth/utils/otp.util';
import { createValidationError } from 'src/common/utils/create-validation-error.util';

jest.mock('src/auth/utils/otp.util');

describe('SettingsService', () => {
  let service: SettingsService;
  let redisService: jest.Mocked<RedisService>;
  let emailQueue: jest.Mocked<Queue>;

  const mockUsersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    updateUserEmail: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockEmailQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: getQueueToken('email'),
          useValue: mockEmailQueue,
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    redisService = module.get(RedisService);
    emailQueue = module.get(getQueueToken('email'));

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkNewEmail', () => {
    const userId = BigInt(1);
    const dto: InititateEmailUpdateDto = {
      newEmail: 'newemail@example.com',
    };

    it('should successfully initiate email update', async () => {
      const currentUser = {
        id: userId,
        email: 'current@example.com',
        username: 'testuser',
        password: 'hashedpassword',
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.findById.mockResolvedValue(currentUser);
      (otpUtil.generateAndStoreOtp as jest.Mock).mockResolvedValue(undefined);

      const result = await service.checkNewEmail(userId, dto);

      expect(result).toHaveProperty('confirmationToken');
      expect(typeof result.confirmationToken).toBe('string');
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(dto.newEmail);
      expect(mockUsersService.findById).toHaveBeenCalledWith(userId);
      expect(otpUtil.generateAndStoreOtp).toHaveBeenCalled();
    });

    it('should throw CONFLICT if new email already exists', async () => {
      const existingUser = {
        id: BigInt(2),
        email: 'newemail@example.com',
        username: 'anotheruser',
        password: 'hashedpassword',
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUsersService.findByEmail.mockResolvedValue(existingUser);

      await expect(service.checkNewEmail(userId, dto)).rejects.toThrow(HttpException);
      await expect(service.checkNewEmail(userId, dto)).rejects.toMatchObject({
        response: {
          message: USERS_ERROR_MESSAGES.EMAIL_ALREADY_USED,
          code: USERS_ERROR_CODES.EMAIL_ALREADY_USED,
        },
        status: HttpStatus.CONFLICT,
      });

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(dto.newEmail);
      expect(mockUsersService.findById).not.toHaveBeenCalled();
    });

    it('should throw NOT_FOUND if current user does not exist', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.findById.mockResolvedValue(null);

      await expect(service.checkNewEmail(userId, dto)).rejects.toThrow(HttpException);
      await expect(service.checkNewEmail(userId, dto)).rejects.toMatchObject({
        response: {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        status: HttpStatus.NOT_FOUND,
      });

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(dto.newEmail);
      expect(mockUsersService.findById).toHaveBeenCalledWith(userId);
    });

    it('should call generateAndStoreOtp with correct parameters', async () => {
      const currentUser = {
        id: userId,
        email: 'current@example.com',
        username: 'testuser',
        password: 'hashedpassword',
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.findById.mockResolvedValue(currentUser);
      (otpUtil.generateAndStoreOtp as jest.Mock).mockResolvedValue(undefined);

      await service.checkNewEmail(userId, dto);

      expect(otpUtil.generateAndStoreOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: dto.newEmail,
          emailQueue: emailQueue,
          otpType: OtpType.CHANGE_EMAIL,
        }),
        redisService,
      );
    });
  });

  describe('verifyEmailUpdate', () => {
    const userId = BigInt(1);
    const dto: VerifyEmailUpdateDto = {
      confirmationToken: 'test-token-123',
      otp: '123456',
    };

    it('should successfully verify email update', async () => {
      const hashedOtp = await bcrypt.hash('123456', 10);
      const cachedData = {
        userId: '1',
        otp: hashedOtp,
        newEmail: 'newemail@example.com',
        username: 'testuser',
        currEmail: 'old@example.com',
        verified: false,
      };

      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedData));
      mockUsersService.updateUserEmail.mockResolvedValue(undefined);
      mockRedisService.del.mockResolvedValue(1);
      mockEmailQueue.add.mockResolvedValue({} as unknown as never);

      const result = await service.verifyEmailUpdate(userId, dto);

      expect(result).toEqual({ message: 'Email address updated successfully.' });
      expect(mockRedisService.get).toHaveBeenCalled();
      expect(mockUsersService.updateUserEmail).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          newEmail: cachedData.newEmail,
          verified: true,
        }),
      );
      expect(mockRedisService.del).toHaveBeenCalledTimes(2);
      expect(mockEmailQueue.add).toHaveBeenCalledWith(
        'sendEmailChange',
        expect.objectContaining({
          email: cachedData.newEmail,
          username: cachedData.username,
          oldEmail: cachedData.currEmail,
          type: OtpType.CHANGE_EMAIL_COMPLETE,
        }),
      );
    });

    it('should throw BAD_REQUEST if token is invalid', async () => {
      mockRedisService.get.mockResolvedValue(null);

      await expect(service.verifyEmailUpdate(userId, dto)).rejects.toThrow(HttpException);
      await expect(service.verifyEmailUpdate(userId, dto)).rejects.toThrow(
        new BadRequestException(
          createValidationError('confirmationToken', {
            invalidToken: AUTH_ERROR_MESSAGES.INVALID_CONFIRMATION_TOKEN,
          }),
        ),
      );

      expect(mockRedisService.get).toHaveBeenCalled();
      expect(mockUsersService.updateUserEmail).not.toHaveBeenCalled();
    });

    it('should throw OtpFailedException if OTP is invalid', async () => {
      const hashedOtp = await bcrypt.hash('wrongotp', 10);
      const cachedData = {
        userId: '1',
        otp: hashedOtp,
        newEmail: 'newemail@example.com',
        username: 'testuser',
        currEmail: 'old@example.com',
        verified: false,
      };

      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedData));

      await expect(service.verifyEmailUpdate(userId, dto)).rejects.toThrow(
        new BadRequestException(
          createValidationError('confirmationToken', {
            invalidToken: AUTH_ERROR_MESSAGES.INVALID_CONFIRMATION_TOKEN,
          }),
        ),
      );
      await expect(service.verifyEmailUpdate(userId, dto)).rejects.toMatchObject({
        message: 'Bad Request Exception',
      });

      expect(mockRedisService.get).toHaveBeenCalled();
      expect(mockUsersService.updateUserEmail).not.toHaveBeenCalled();
      expect(mockEmailQueue.add).not.toHaveBeenCalled();
    });

    it('should delete redis keys after successful verification', async () => {
      const hashedOtp = await bcrypt.hash('123456', 10);
      const cachedData = {
        userId: '1',
        otp: hashedOtp,
        newEmail: 'newemail@example.com',
        username: 'testuser',
        currEmail: 'old@example.com',
        verified: false,
      };

      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedData));
      mockUsersService.updateUserEmail.mockResolvedValue(undefined);
      mockRedisService.del.mockResolvedValue(1);
      mockEmailQueue.add.mockResolvedValue({} as unknown as never);

      await service.verifyEmailUpdate(userId, dto);

      expect(mockRedisService.del).toHaveBeenCalledTimes(2);
      expect(mockRedisService.del).toHaveBeenCalledWith(
        expect.stringContaining(dto.confirmationToken),
      );
    });
  });

  describe('resendEmailUpdateOtp', () => {
    const userId = BigInt(1);
    const dto: ResendEmailUpdateOtp = {
      confirmationToken: 'test-token-123',
    };

    it('should successfully resend OTP', async () => {
      const cachedData = {
        userId: '1',
        otp: 'old-hashed-otp',
        newEmail: 'newemail@example.com',
        username: 'testuser',
        currEmail: 'old@example.com',
        verified: false,
      };

      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedData));
      (otpUtil.generateAndStoreOtp as jest.Mock).mockResolvedValue(undefined);

      const result = await service.resendEmailUpdateOtp(userId, dto);

      expect(result).toEqual({ message: 'OTP resent successfully.' });
      expect(mockRedisService.get).toHaveBeenCalled();
      expect(otpUtil.generateAndStoreOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: cachedData.newEmail,
          emailQueue: emailQueue,
          otpType: OtpType.CHANGE_EMAIL,
        }),
        redisService,
      );
    });

    it('should throw BAD_REQUEST if token is invalid', async () => {
      mockRedisService.get.mockResolvedValue(null);

      await expect(service.resendEmailUpdateOtp(userId, dto)).rejects.toThrow(HttpException);
      await expect(service.resendEmailUpdateOtp(userId, dto)).rejects.toThrow(
        new BadRequestException(
          createValidationError('confirmationToken', {
            invalidToken: AUTH_ERROR_MESSAGES.INVALID_CONFIRMATION_TOKEN,
          }),
        ),
      );

      expect(mockRedisService.get).toHaveBeenCalled();
      expect(otpUtil.generateAndStoreOtp).not.toHaveBeenCalled();
    });

    it('should reset otp and verified flag before resending', async () => {
      const cachedData = {
        userId: '1',
        otp: 'old-hashed-otp',
        newEmail: 'newemail@example.com',
        username: 'testuser',
        currEmail: 'old@example.com',
        verified: true,
      };

      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedData));
      (otpUtil.generateAndStoreOtp as jest.Mock).mockResolvedValue(undefined);

      await service.resendEmailUpdateOtp(userId, dto);

      const expectedData = expect.objectContaining({
        otp: '',
        verified: false,
      }) as unknown as Record<string, unknown>;

      expect(otpUtil.generateAndStoreOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expectedData,
        }),
        redisService,
      );
    });

    it('should preserve email update data when resending', async () => {
      const cachedData = {
        userId: '1',
        otp: 'old-hashed-otp',
        newEmail: 'newemail@example.com',
        username: 'testuser',
        currEmail: 'old@example.com',
        verified: false,
      };

      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedData));
      (otpUtil.generateAndStoreOtp as jest.Mock).mockResolvedValue(undefined);

      await service.resendEmailUpdateOtp(userId, dto);

      const expectedData = expect.objectContaining({
        newEmail: cachedData.newEmail,
        username: cachedData.username,
        currEmail: cachedData.currEmail,
        userId: cachedData.userId,
      }) as unknown as Record<string, unknown>;

      expect(otpUtil.generateAndStoreOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expectedData,
        }),
        redisService,
      );
    });
  });
});
