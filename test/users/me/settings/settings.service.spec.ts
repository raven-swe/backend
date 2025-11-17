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
import { USERS_ERROR_CODES, USERS_ERROR_MESSAGES } from 'src/common/constants';
import { AUTH_ERROR_MESSAGES } from 'src/auth/constants';
import { OtpType } from 'src/email/interfaces';
import * as bcrypt from 'bcrypt';
import * as otpUtil from 'src/auth/utils';
import { createValidationError } from 'src/common/utils';

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
});
