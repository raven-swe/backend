import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from 'src/users/me/settings/settings.service';
import { UsersService } from 'src/users/users.service';
import { RedisService } from 'src/redis/redis.service';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import {
  InititateEmailUpdateDto,
  VerifyEmailUpdateDto,
  ResendEmailUpdateOtp,
} from 'src/users/dtos';
import { USERS_ERROR_CODES, USERS_ERROR_MESSAGES } from 'src/users/constants';
import { AUTH_ERROR_MESSAGES } from 'src/auth/constants';
import { OtpType } from 'src/email/interfaces';
import * as bcrypt from 'bcrypt';
import * as otpUtil from 'src/auth/utils';
import { createValidationError } from 'src/common/utils';
import {
  PAGINATION_ERROR_CODES,
  PAGINATION_ERROR_MESSAGES,
} from 'src/common/constants/pagination-error-codes';

jest.mock('src/auth/utils/otp.util');

describe('SettingsService', () => {
  let service: SettingsService;
  let redisService: jest.Mocked<RedisService>;
  let emailQueue: jest.Mocked<Queue>;

  const mockUsersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    updateUserEmail: jest.fn(),
    updateUsernameById: jest.fn(),
    getUserDetails: jest.fn(),
    updateBirthDate: jest.fn(),
    getUserSSOs: jest.fn(),
    removeUserSSO: jest.fn(),
    getCountries: jest.fn(),
    changeCountry: jest.fn(),
    updateGender: jest.fn(),
    updateLanguage: jest.fn(),
    validateLoggedInUser: jest.fn(),
    getSessions: jest.fn(),
    deleteSession: jest.fn(),
    getUserMutes: jest.fn(),
    getUserBlocks: jest.fn(),
    updateInterests: jest.fn(),
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

  describe('updateUsername', () => {
    const userId = BigInt(1);
    const newUsername = 'newusername';
    const dto = {
      newUsername,
    };

    it('should successfully update username', async () => {
      const expectedResponse = { message: 'Username updated successfully.' };
      mockUsersService.updateUsernameById.mockResolvedValue(expectedResponse);

      const result = await service.updateUsername(userId, dto);

      expect(result).toEqual(expectedResponse);
      expect(mockUsersService.updateUsernameById).toHaveBeenCalledWith(userId, newUsername);
      expect(mockUsersService.updateUsernameById).toHaveBeenCalledTimes(1);
    });

    it('should call updateUsernameById with correct parameters', async () => {
      const expectedResponse = { message: 'Username updated successfully.' };
      mockUsersService.updateUsernameById.mockResolvedValue(expectedResponse);

      await service.updateUsername(userId, dto);

      expect(mockUsersService.updateUsernameById).toHaveBeenCalledWith(userId, newUsername);
    });

    it('should return the response from usersService.updateUsernameById', async () => {
      const customResponse = { message: 'Custom success message' };
      mockUsersService.updateUsernameById.mockResolvedValue(customResponse);

      const result = await service.updateUsername(userId, dto);

      expect(result).toBe(customResponse);
    });

    it('should propagate errors from usersService.updateUsernameById', async () => {
      const error = new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USERNAME_ALREADY_USED,
          code: USERS_ERROR_CODES.USERNAME_ALREADY_USED,
        },
        HttpStatus.CONFLICT,
      );

      mockUsersService.updateUsernameById.mockRejectedValue(error);

      await expect(service.updateUsername(userId, dto)).rejects.toThrow(error);
      expect(mockUsersService.updateUsernameById).toHaveBeenCalledWith(userId, newUsername);
    });

    it('should handle different username values', async () => {
      const testCases = [
        'user123',
        'test_user',
        'NewUser2024',
        'a',
        'very_long_username_with_numbers_123',
      ];

      for (const username of testCases) {
        const testDto = { newUsername: username };
        const expectedResponse = { message: 'Username updated successfully.' };
        mockUsersService.updateUsernameById.mockResolvedValue(expectedResponse);

        await service.updateUsername(userId, testDto);

        expect(mockUsersService.updateUsernameById).toHaveBeenCalledWith(userId, username);
        jest.clearAllMocks();
      }
    });

    it('should handle case when username is unchanged', async () => {
      const testDto = { newUsername: 'existingUsername' };
      const expectedResponse = { message: 'Username updated successfully.' };

      mockUsersService.updateUsernameById.mockResolvedValue(expectedResponse);

      const result = await service.updateUsername(userId, testDto);

      expect(mockUsersService.updateUsernameById).toHaveBeenCalledWith(userId, testDto.newUsername);
      expect(result).toEqual(expectedResponse);
    });

    it('should handle case-only username changes', async () => {
      const testDto = { newUsername: 'JohnDoe' };
      const expectedResponse = { message: 'Username updated successfully.' };

      mockUsersService.updateUsernameById.mockResolvedValue(expectedResponse);

      const result = await service.updateUsername(userId, testDto);

      expect(mockUsersService.updateUsernameById).toHaveBeenCalledWith(userId, testDto.newUsername);
      expect(result).toEqual(expectedResponse);
    });

    it('should throw conflict error when username is taken by another user', async () => {
      const testDto = { newUsername: 'takenUsername' };
      const error = new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USERNAME_ALREADY_USED,
          code: USERS_ERROR_CODES.USERNAME_ALREADY_USED,
        },
        HttpStatus.CONFLICT,
      );

      mockUsersService.updateUsernameById.mockRejectedValue(error);

      await expect(service.updateUsername(userId, testDto)).rejects.toThrow(error);
      expect(mockUsersService.updateUsernameById).toHaveBeenCalledWith(userId, testDto.newUsername);
    });

    it('should throw not found error when user does not exist', async () => {
      const testDto = { newUsername: 'newUsername' };
      const error = new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );

      mockUsersService.updateUsernameById.mockRejectedValue(error);

      await expect(service.updateUsername(userId, testDto)).rejects.toThrow(error);
    });

    it('should log successful username update', async () => {
      const testDto = { newUsername: 'newUsername123' };
      const expectedResponse = { message: 'Username updated successfully.' };
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      mockUsersService.updateUsernameById.mockResolvedValue(expectedResponse);

      await service.updateUsername(userId, testDto);

      expect(loggerSpy).toHaveBeenCalledWith(
        `Update username completed for ${testDto.newUsername}`,
      );
    });
  });

  describe('getUserDetails', () => {
    it('should return user details successfully', async () => {
      // Arrange
      const userId = BigInt(1);
      const expectedDetails = {
        username: 'testuser',
        email: 'test@example.com',
        accountCreationDate: new Date(),
        accountCreationIp: '127.0.0.1',
        country: 'Egypt',
        languages: ['EN'],
        gender: 'Male',
        birthDate: '1990-01-01',
        age: 34,
      };

      mockUsersService.getUserDetails.mockResolvedValue(expectedDetails);

      // Act
      const result = await service.getUserDetails(userId);

      // Assert
      expect(result).toEqual(expectedDetails);
      expect(mockUsersService.getUserDetails).toHaveBeenCalledWith(userId);
      expect(mockUsersService.getUserDetails).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateBirthDate', () => {
    it('should update birth date successfully', async () => {
      // Arrange
      const userId = BigInt(1);
      const birthDate = new Date('1995-05-15');
      const expectedResult = { message: 'Birth date updated successfully.' };

      mockUsersService.updateBirthDate.mockResolvedValue(expectedResult);

      // Act
      const result = await service.updateBirthDate(userId, birthDate);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockUsersService.updateBirthDate).toHaveBeenCalledWith(userId, birthDate);
      expect(mockUsersService.updateBirthDate).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUserSSOs', () => {
    it('should return user SSOs successfully', async () => {
      // Arrange
      const userId = BigInt(1);
      const expectedSSOs = [
        {
          provider: 'google',
          displayIdentifier: 'test@gmail.com',
          status: 'Connected',
          connectedAt: new Date(),
        },
      ];

      mockUsersService.getUserSSOs.mockResolvedValue(expectedSSOs);

      // Act
      const result = await service.getUserSSOs(userId);

      // Assert
      expect(result).toEqual(expectedSSOs);
      expect(mockUsersService.getUserSSOs).toHaveBeenCalledWith(userId);
      expect(mockUsersService.getUserSSOs).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeUserSSO', () => {
    it('should remove user SSO successfully', async () => {
      // Arrange
      const userId = BigInt(1);
      const provider = 'google';
      const currentPassword = 'password123';
      const expectedResult = { message: 'Account disconnected successfully.' };

      mockUsersService.removeUserSSO.mockResolvedValue(expectedResult);

      // Act
      const result = await service.removeUserSSO(userId, provider, currentPassword);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockUsersService.removeUserSSO).toHaveBeenCalledWith(
        userId,
        provider,
        currentPassword,
      );
      expect(mockUsersService.removeUserSSO).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCountries', () => {
    it('should return list of countries successfully', async () => {
      // Arrange
      const expectedCountries = [
        { code: 'EG', name: 'Egypt' },
        { code: 'US', name: 'United States' },
        { code: 'GB', name: 'United Kingdom' },
      ];

      mockUsersService.getCountries.mockResolvedValue(expectedCountries);

      // Act
      const result = await service.getCountries();

      // Assert
      expect(result).toEqual(expectedCountries);
      expect(mockUsersService.getCountries).toHaveBeenCalled();
      expect(mockUsersService.getCountries).toHaveBeenCalledTimes(1);
    });
  });

  describe('changeCountry', () => {
    it('should change country successfully', async () => {
      // Arrange
      const userId = BigInt(1);
      const countryName = 'Egypt';
      const expectedResult = { message: 'Country updated successfully.' };

      mockUsersService.changeCountry.mockResolvedValue(expectedResult);

      // Act
      const result = await service.changeCountry(userId, countryName);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockUsersService.changeCountry).toHaveBeenCalledWith(userId, countryName);
      expect(mockUsersService.changeCountry).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateGender', () => {
    it('should update gender successfully', async () => {
      // Arrange
      const userId = BigInt(1);
      const gender = 'Male';
      const expectedResult = { message: 'Gender updated successfully.' };

      mockUsersService.updateGender.mockResolvedValue(expectedResult);

      // Act
      const result = await service.updateGender(userId, gender);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockUsersService.updateGender).toHaveBeenCalledWith(userId, gender);
      expect(mockUsersService.updateGender).toHaveBeenCalledTimes(1);
    });

    it('should update gender to Female', async () => {
      // Arrange
      const userId = BigInt(1);
      const gender = 'Female';
      const expectedResult = { message: 'Gender updated successfully.' };

      mockUsersService.updateGender.mockResolvedValue(expectedResult);

      // Act
      const result = await service.updateGender(userId, gender);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockUsersService.updateGender).toHaveBeenCalledWith(userId, gender);
    });
  });

  describe('updateLanguage', () => {
    it('should update language successfully', async () => {
      // Arrange
      const userId = BigInt(1);
      const language = 'EN';
      const expectedResult = { message: 'Default language updated successfully.' };

      mockUsersService.updateLanguage.mockResolvedValue(expectedResult);

      // Act
      const result = await service.updateLanguage(userId, language);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockUsersService.updateLanguage).toHaveBeenCalledWith(userId, language);
      expect(mockUsersService.updateLanguage).toHaveBeenCalledTimes(1);
    });

    it('should update language to Arabic', async () => {
      // Arrange
      const userId = BigInt(1);
      const language = 'AR';
      const expectedResult = { message: 'Default language updated successfully.' };

      mockUsersService.updateLanguage.mockResolvedValue(expectedResult);

      // Act
      const result = await service.updateLanguage(userId, language);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockUsersService.updateLanguage).toHaveBeenCalledWith(userId, language);
    });
  });

  describe('validatePassword', () => {
    it('should return isValid true for correct password', async () => {
      // Arrange
      const userId = BigInt(1);
      const password = 'correctPassword123';

      mockUsersService.validateLoggedInUser.mockResolvedValue(true);

      // Act
      const result = await service.validatePassword(userId, password);

      // Assert
      expect(result).toEqual({ isValid: true });
      expect(mockUsersService.validateLoggedInUser).toHaveBeenCalledWith(userId, password);
      expect(mockUsersService.validateLoggedInUser).toHaveBeenCalledTimes(1);
    });

    it('should throw error for incorrect password', async () => {
      // Arrange
      const userId = BigInt(1);
      const password = 'wrongPassword';

      mockUsersService.validateLoggedInUser.mockResolvedValue(false);

      // Act & Assert
      await expect(service.validatePassword(userId, password)).rejects.toThrow(HttpException);
      await expect(service.validatePassword(userId, password)).rejects.toMatchObject({
        response: {
          message: USERS_ERROR_MESSAGES.INVALID_PASSWORD,
          code: USERS_ERROR_CODES.INVALID_PASSWORD,
        },
        status: HttpStatus.FORBIDDEN,
      });

      expect(mockUsersService.validateLoggedInUser).toHaveBeenCalledWith(userId, password);
    });
  });

  describe('getSessions', () => {
    it('should return user sessions successfully', async () => {
      // Arrange
      const userId = BigInt(1);
      const refreshToken = 'valid-refresh-token';
      const expectedSessions = [
        {
          id: BigInt(1),
          deviceType: 'Web',
          lastActive: new Date(),
          isCurrent: true,
        },
        {
          id: BigInt(2),
          deviceType: 'Mobile',
          lastActive: new Date(),
          isCurrent: false,
        },
      ];

      mockUsersService.getSessions.mockResolvedValue(expectedSessions);

      // Act
      const result = await service.getSessions(userId, refreshToken);

      // Assert
      expect(result).toEqual(expectedSessions);
      expect(mockUsersService.getSessions).toHaveBeenCalledWith(userId, refreshToken);
      expect(mockUsersService.getSessions).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteSession', () => {
    it('should delete session successfully', async () => {
      // Arrange
      const userId = BigInt(1);
      const sessionId = BigInt(2);
      const refreshToken = 'valid-refresh-token';
      const expectedResult = { message: 'Session terminated successfully.' };

      mockUsersService.deleteSession.mockResolvedValue(expectedResult);

      // Act
      const result = await service.deleteSession(userId, sessionId, refreshToken);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockUsersService.deleteSession).toHaveBeenCalledWith(userId, sessionId, refreshToken);
      expect(mockUsersService.deleteSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUserMutedUsers', () => {
    const userId = BigInt(1);
    const limit = 2;

    // Helper to encode a valid cursor

    const encodeValidCursor = (userId: string, mutedId: string): string => {
      const cursorObj = { userId, mutedId };
      return Buffer.from(JSON.stringify(cursorObj)).toString('base64');
    };

    beforeEach(() => {
      // Add getUserMutes to mock if not already present
      if (!mockUsersService.getUserMutes) {
        mockUsersService.getUserMutes = jest.fn();
      }
    });

    it('should return muted users without cursor (first page)', async () => {
      // Arrange: 3 muted users returned (limit+1 to detect hasNextPage)
      const mockMutedUsers = [
        {
          userId: BigInt(1),
          mutedId: BigInt(2),
          createdAt: new Date(),
          mutedUser: {
            id: BigInt(2),
            username: 'muted1',
            profile: {
              displayName: 'muted One',
              bio: 'Bio 1',
              bioEntities: null,
              avatarUrl: 'https://example.com/avatar1.jpg',
            },
          },
        },
        {
          userId: BigInt(1),
          mutedId: BigInt(3),
          createdAt: new Date(),
          mutedUser: {
            id: BigInt(3),
            username: 'muted2',
            profile: {
              displayName: 'muted Two',
              bio: 'Bio 2',
              bioEntities: null,
              avatarUrl: 'https://example.com/avatar2.jpg',
            },
          },
        },
        {
          userId: BigInt(1),
          mutedId: BigInt(4),
          createdAt: new Date(),
          mutedUser: {
            id: BigInt(4),
            username: 'muted3',
            profile: {
              displayName: 'muted Three',
              bio: 'Bio 3',
              bioEntities: null,
              avatarUrl: 'https://example.com/avatar3.jpg',
            },
          },
        },
      ];

      mockUsersService.getUserMutes.mockResolvedValue(mockMutedUsers);

      // Act
      const result = await service.getUserMutedUsers(userId, limit);

      // Assert
      expect(mockUsersService.getUserMutes).toHaveBeenCalledWith(
        userId,
        limit + 1,
        undefined, // no cursor decoded
      );

      // Only first 2 items returned (limit=2), third is used for pagination
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({
        displayName: 'muted One',
        bio: 'Bio 1',
        username: 'muted1',
      });
      expect(result.items[1]).toMatchObject({
        displayName: 'muted Two',
        bio: 'Bio 2',
        username: 'muted2',
      });

      // Pagination should indicate next page
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.nextCursor).toBeTruthy();
    });

    it('should return muted users with valid cursor (subsequent page)', async () => {
      // Arrange
      const validCursor = encodeValidCursor('1', '2'); // userId=1, mutedId=2
      const mockmutedUsers = [
        {
          userId: BigInt(1),
          mutedId: BigInt(5),
          createdAt: new Date(),
          mutedUser: {
            id: BigInt(5),
            username: 'muted5',
            profile: {
              displayName: 'muted Five',
              bio: 'Bio 5',
              bioEntities: null,
              avatarUrl: 'https://example.com/avatar5.jpg',
            },
          },
        },
        {
          userId: BigInt(1),
          mutedId: BigInt(6),
          createdAt: new Date(),
          mutedUser: {
            id: BigInt(6),
            username: 'muted6',
            profile: {
              displayName: 'muted Six',
              bio: 'Bio 6',
              bioEntities: null,
              avatarUrl: 'https://example.com/avatar6.jpg',
            },
          },
        },
      ];
      mockUsersService.getUserMutes.mockResolvedValue(mockmutedUsers);

      // Act
      const result = await service.getUserMutedUsers(userId, limit, validCursor);

      // Assert
      expect(mockUsersService.getUserMutes).toHaveBeenCalledWith(
        userId,
        limit + 1,
        { userId: '1', mutedId: '2' }, // decoded cursor
      );

      expect(result.items).toHaveLength(2);
      expect(result.pagination.cursor).toBe(validCursor); // prevCursor echoed back
      expect(result.pagination.hasNextPage).toBe(false); // only 2 items, no extra
    });

    it('should throw BadRequest for invalid cursor format', async () => {
      // Arrange: a cursor that is not valid base64 JSON
      const invalidCursor = 'not-valid-base64!!!';

      // Act & Assert
      await expect(service.getUserMutedUsers(userId, limit, invalidCursor)).rejects.toThrow(
        HttpException,
      );

      await expect(service.getUserMutedUsers(userId, limit, invalidCursor)).rejects.toMatchObject({
        response: {
          message: PAGINATION_ERROR_MESSAGES.INVALID_CURSOR,
          code: PAGINATION_ERROR_CODES.INVALID_CURSOR,
        },
        status: HttpStatus.BAD_REQUEST,
      });

      expect(mockUsersService.getUserMutes).not.toHaveBeenCalled();
    });

    it('should use default limit (20) when no limit provided', async () => {
      // Arrange
      mockUsersService.getUserMutes.mockResolvedValue([]);

      // Act
      await service.getUserMutedUsers(userId);

      // Assert
      expect(mockUsersService.getUserMutes).toHaveBeenCalledWith(
        userId,
        21, // default limit + 1
        undefined,
      );
    });

    it('should pass through service errors', async () => {
      // Arrange
      const error = new Error('Database error');
      mockUsersService.getUserMutes.mockRejectedValue(error);

      // Act & Assert
      await expect(service.getUserMutedUsers(userId, limit)).rejects.toThrow('Database error');
      expect(mockUsersService.getUserMutes).toHaveBeenCalledWith(userId, limit + 1, undefined);
    });
  });

  ///////////////////////////////////////////////////////////////////////
  describe('getUserBlockedUsers', () => {
    const userId = BigInt(1);
    const limit = 2;

    // Helper to encode a valid cursor
    const encodeValidCursor = (userId: string, blockedId: string): string => {
      const cursorObj = { userId, blockedId };
      return Buffer.from(JSON.stringify(cursorObj)).toString('base64');
    };

    beforeEach(() => {
      // Add getUserBlocks to mock if not already present
      if (!mockUsersService.getUserBlocks) {
        mockUsersService.getUserBlocks = jest.fn();
      }
    });

    it('should return blocked users without cursor (first page)', async () => {
      // Arrange: 3 blocked users returned (limit+1 to detect hasNextPage)
      const mockBlockedUsers = [
        {
          userId: BigInt(1),
          blockedId: BigInt(2),
          createdAt: new Date(),
          blockedUser: {
            id: BigInt(2),
            username: 'blocked1',
            profile: {
              displayName: 'Blocked One',
              bio: 'Bio 1',
              bioEntities: null,
              avatarUrl: 'https://example.com/avatar1.jpg',
            },
          },
        },
        {
          userId: BigInt(1),
          blockedId: BigInt(3),
          createdAt: new Date(),
          blockedUser: {
            id: BigInt(3),
            username: 'blocked2',
            profile: {
              displayName: 'Blocked Two',
              bio: 'Bio 2',
              bioEntities: null,
              avatarUrl: 'https://example.com/avatar2.jpg',
            },
          },
        },
        {
          userId: BigInt(1),
          blockedId: BigInt(4),
          createdAt: new Date(),
          blockedUser: {
            id: BigInt(4),
            username: 'blocked3',
            profile: {
              displayName: 'Blocked Three',
              bio: 'Bio 3',
              bioEntities: null,
              avatarUrl: 'https://example.com/avatar3.jpg',
            },
          },
        },
      ];

      mockUsersService.getUserBlocks.mockResolvedValue(mockBlockedUsers);

      // Act
      const result = await service.getUserBlockedUsers(userId, limit);

      // Assert
      expect(mockUsersService.getUserBlocks).toHaveBeenCalledWith(
        userId,
        limit + 1,
        undefined, // no cursor decoded
      );

      // Only first 2 items returned (limit=2), third is used for pagination
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({
        displayName: 'Blocked One',
        bio: 'Bio 1',
        username: 'blocked1',
      });
      expect(result.items[1]).toMatchObject({
        displayName: 'Blocked Two',
        bio: 'Bio 2',
        username: 'blocked2',
      });

      // Pagination should indicate next page
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.nextCursor).toBeTruthy();
    });

    it('should return blocked users with valid cursor (subsequent page)', async () => {
      // Arrange
      const validCursor = encodeValidCursor('1', '2'); // userId=1, blockedId=2
      const mockBlockedUsers = [
        {
          userId: BigInt(1),
          blockedId: BigInt(5),
          createdAt: new Date(),
          blockedUser: {
            id: BigInt(5),
            username: 'blocked5',
            profile: {
              displayName: 'Blocked Five',
              bio: 'Bio 5',
              bioEntities: null,
              avatarUrl: 'https://example.com/avatar5.jpg',
            },
          },
        },
        {
          userId: BigInt(1),
          blockedId: BigInt(6),
          createdAt: new Date(),
          blockedUser: {
            id: BigInt(6),
            username: 'blocked6',
            profile: {
              displayName: 'Blocked Six',
              bio: 'Bio 6',
              bioEntities: null,
              avatarUrl: 'https://example.com/avatar6.jpg',
            },
          },
        },
      ];

      mockUsersService.getUserBlocks.mockResolvedValue(mockBlockedUsers);

      // Act
      const result = await service.getUserBlockedUsers(userId, limit, validCursor);

      // Assert
      expect(mockUsersService.getUserBlocks).toHaveBeenCalledWith(
        userId,
        limit + 1,
        { userId: '1', blockedId: '2' }, // decoded cursor
      );

      expect(result.items).toHaveLength(2);
      expect(result.pagination.cursor).toBe(validCursor); // prevCursor echoed back
      expect(result.pagination.hasNextPage).toBe(false); // only 2 items, no extra
    });

    it('should throw BadRequest for invalid cursor format', async () => {
      // Arrange: a cursor that is not valid base64 JSON
      const invalidCursor = 'not-valid-base64!!!';

      // Act & Assert
      await expect(service.getUserBlockedUsers(userId, limit, invalidCursor)).rejects.toThrow(
        HttpException,
      );

      await expect(service.getUserBlockedUsers(userId, limit, invalidCursor)).rejects.toMatchObject(
        {
          response: {
            message: PAGINATION_ERROR_MESSAGES.INVALID_CURSOR,
            code: PAGINATION_ERROR_CODES.INVALID_CURSOR,
          },
          status: HttpStatus.BAD_REQUEST,
        },
      );

      expect(mockUsersService.getUserBlocks).not.toHaveBeenCalled();
    });

    it('should use default limit (20) when no limit provided', async () => {
      // Arrange
      mockUsersService.getUserBlocks.mockResolvedValue([]);

      // Act
      await service.getUserBlockedUsers(userId);

      // Assert
      expect(mockUsersService.getUserBlocks).toHaveBeenCalledWith(
        userId,
        21, // default limit + 1
        undefined,
      );
    });

    it('should pass through service errors', async () => {
      // Arrange
      const error = new Error('Database error');
      mockUsersService.getUserBlocks.mockRejectedValue(error);

      // Act & Assert
      await expect(service.getUserBlockedUsers(userId, limit)).rejects.toThrow('Database error');
      expect(mockUsersService.getUserBlocks).toHaveBeenCalledWith(userId, limit + 1, undefined);
    });
  });

  describe('getInterests', () => {
    const userId = BigInt(1);

    it('should return all interests with isSelected=false when user has no interests', async () => {
      // Arrange
      const mockUser = {
        id: userId,
        interests: [],
      };
      mockUsersService.findById.mockResolvedValue(mockUser);

      // Act
      const result = await service.getInterests(userId);

      // Assert
      expect(mockUsersService.findById).toHaveBeenCalledWith(userId);
      expect(result).toHaveLength(11); // All 11 interest codes
      expect(result.every((interest) => !interest.isSelected)).toBe(true);
      expect(result[0]).toHaveProperty('code');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('isSelected');
    });

    it('should return interests with correct isSelected status', async () => {
      // Arrange
      const mockUser = {
        id: userId,
        interests: ['TECH', 'SPORTS', 'FOOD'],
      };
      mockUsersService.findById.mockResolvedValue(mockUser);

      // Act
      const result = await service.getInterests(userId);

      // Assert
      expect(result).toHaveLength(11);
      const techInterest = result.find((i) => i.code === 'TECH');
      const sportsInterest = result.find((i) => i.code === 'SPORTS');
      const cultureInterest = result.find((i) => i.code === 'CULTURE');

      expect(techInterest?.isSelected).toBe(true);
      expect(sportsInterest?.isSelected).toBe(true);
      expect(cultureInterest?.isSelected).toBe(false);
    });

    it('should handle null interests field', async () => {
      // Arrange
      const mockUser = {
        id: userId,
        interests: null,
      };
      mockUsersService.findById.mockResolvedValue(mockUser);

      // Act
      const result = await service.getInterests(userId);

      // Assert
      expect(result).toHaveLength(11);
      expect(result.every((interest) => !interest.isSelected)).toBe(true);
    });

    it('should throw NOT_FOUND when user does not exist', async () => {
      // Arrange
      mockUsersService.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getInterests(userId)).rejects.toThrow(HttpException);
      await expect(service.getInterests(userId)).rejects.toMatchObject({
        response: {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('should return interests with correct names from INTEREST_NAMES mapping', async () => {
      // Arrange
      const mockUser = { id: userId, interests: [] };
      mockUsersService.findById.mockResolvedValue(mockUser);

      // Act
      const result = await service.getInterests(userId);

      // Assert
      const techInterest = result.find((i) => i.code === 'TECH');
      expect(techInterest?.name).toBe('Tech');
      const sportsInterest = result.find((i) => i.code === 'SPORTS');
      expect(sportsInterest?.name).toBe('Sports');
    });
  });

  describe('updateInterests', () => {
    const userId = BigInt(1);

    it('should successfully update interests with valid data', async () => {
      // Arrange
      const dto = { interests: ['TECH', 'SPORTS', 'FOOD'] };
      mockUsersService.updateInterests.mockResolvedValue(undefined);

      // Act
      const result = await service.updateInterests(userId, dto);

      // Assert
      expect(mockUsersService.updateInterests).toHaveBeenCalledWith(userId, [
        'TECH',
        'SPORTS',
        'FOOD',
      ]);
      expect(result).toEqual({ message: 'Interests updated successfully.' });
    });

    it('should remove duplicates before updating', async () => {
      // Arrange
      const dto = { interests: ['TECH', 'SPORTS', 'TECH', 'FOOD', 'SPORTS'] };
      mockUsersService.updateInterests.mockResolvedValue(undefined);

      // Act
      await service.updateInterests(userId, dto);

      // Assert
      expect(mockUsersService.updateInterests).toHaveBeenCalledTimes(1);
      const calls = mockUsersService.updateInterests.mock.calls;
      expect(calls).toHaveLength(1);
      const calledWith = calls[0][1] as string[];
      expect(calledWith).toHaveLength(3);
      expect(new Set(calledWith).size).toBe(3); // Verify no duplicates
      expect(calledWith).toContain('TECH');
      expect(calledWith).toContain('SPORTS');
      expect(calledWith).toContain('FOOD');
    });

    it('should accept single interest (minimum requirement)', async () => {
      // Arrange
      const dto = { interests: ['TECH'] };
      mockUsersService.updateInterests.mockResolvedValue(undefined);

      // Act
      const result = await service.updateInterests(userId, dto);

      // Assert
      expect(mockUsersService.updateInterests).toHaveBeenCalledWith(userId, ['TECH']);
      expect(result).toEqual({ message: 'Interests updated successfully.' });
    });

    it('should accept all valid interests', async () => {
      // Arrange
      const allInterests = [
        'CULTURE',
        'FINANCE',
        'MEDICAL',
        'POLITICS',
        'SPORTS',
        'TECH',
        'ENTERTAINMENT',
        'GENERAL',
        'FOOD',
        'LEARNING',
        'TRAVEL',
      ];
      const dto = { interests: allInterests };
      mockUsersService.updateInterests.mockResolvedValue(undefined);

      // Act
      const result = await service.updateInterests(userId, dto);

      // Assert
      expect(mockUsersService.updateInterests).toHaveBeenCalledWith(userId, allInterests);
      expect(result).toEqual({ message: 'Interests updated successfully.' });
    });

    it('should throw BadRequest when interests array is empty', async () => {
      // Arrange
      const dto = { interests: [] };

      // Act & Assert
      await expect(service.updateInterests(userId, dto)).rejects.toThrow(BadRequestException);
      expect(mockUsersService.updateInterests).not.toHaveBeenCalled();
    });

    it('should throw BadRequest when interests contain invalid codes', async () => {
      // Arrange
      const dto = { interests: ['TECH', 'INVALID_CODE', 'SPORTS'] };

      // Act & Assert
      await expect(service.updateInterests(userId, dto)).rejects.toThrow(BadRequestException);
      expect(mockUsersService.updateInterests).not.toHaveBeenCalled();
    });

    it('should handle UsersService errors gracefully', async () => {
      // Arrange
      const dto = { interests: ['TECH'] };
      const dbError = new Error('Database connection failed');
      mockUsersService.updateInterests.mockRejectedValue(dbError);

      // Act & Assert
      await expect(service.updateInterests(userId, dto)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });
});
