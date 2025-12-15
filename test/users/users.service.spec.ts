import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from 'src/users/users.service';
import { UsersRepository } from 'src/users/users.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { LanguageCode, Prisma } from '@prisma/client';
import { ChangePasswordBasicDto, UpdateProfileDto } from 'src/users/dtos';
import { OtpType } from 'src/email/interfaces';
import { comparePassword, hashPassword } from 'src/auth/utils';
import { USERS_ERROR_CODES, USERS_ERROR_MESSAGES } from 'src/users/constants';
import { MediaService } from 'src/media/media.service';
import { MediaFolder } from 'src/media/enums';
import { ContentParsingService } from 'src/content-parsing/content-parsing.service';
import { NewUser } from 'src/users/interfaces';
import { UserRelationshipDto } from 'src/users/dtos/relationship-dto';
import { RedisService } from 'src/redis/redis.service';
import { DomainEventsService } from 'src/events/domain-events.service';

jest.mock('src/auth/utils/password.util');
jest.mock('src/users/utils/validate-password-format.util');

// Cast to jest mocks for TypeScript
const mockComparePassword = comparePassword as jest.MockedFunction<typeof comparePassword>;
const mockHashPassword = hashPassword as jest.MockedFunction<typeof hashPassword>;

describe('UsersService', () => {
  let service: UsersService;

  const mockUser = {
    id: BigInt(1),
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: 'hashedPassword123',
    birthdate: new Date('2000-01-01'),
    languageCode: LanguageCode.EN,
  };

  const mockUserProfile = {
    username: 'testuser',
    displayName: 'Test User',
    bio: 'This is a test bio',
    bioEntities: null,
    location: 'Test City',
    birthDate: new Date('2000-01-01'),
    avatarUrl: 'https://example.com/avatar.jpg',
    bannerUrl: 'https://example.com/banner.jpg',
    websiteUrl: 'https://example.com',
    joinedAt: new Date('2023-01-01'),
    relationship: null,
    followingCount: '100',
    followersCount: '200',
    mutualsCount: 2,
    mutualUsers: ['Omar', 'Tasneem'],
  };

  const mockRepository = {
    findByEmail: jest.fn(),
    findByUsername: jest.fn(),
    findByIdentifier: jest.fn(),
    findById: jest.fn(),
    findByIdWithProfile: jest.fn(),
    createUser: jest.fn(),
    updatePasswordById: jest.fn(),
    updateProfile: jest.fn(),
    findUserProfileByUsername: jest.fn(),
    updateUsernameById: jest.fn(),
    updateUserEmail: jest.fn(),
    isFollowing: jest.fn(),
    isBlocked: jest.fn(),
    followUser: jest.fn(),
    unfollowUser: jest.fn(),
    blockUser: jest.fn(),
    unblockUser: jest.fn(),
    muteUser: jest.fn(),
    unmuteUser: jest.fn(),
    isMuted: jest.fn(),
    checkUsernameExistence: jest.fn(),
    getUserDetails: jest.fn(),
    updateBirthDate: jest.fn(),
    getUserSSOs: jest.fn(),
    validateLoggedInUser: jest.fn(),
    removeUserSSO: jest.fn(),
    getCountries: jest.fn(),
    checkCountry: jest.fn(),
    updateCountry: jest.fn(),
    updateGender: jest.fn(),
    updateLanguage: jest.fn(),
    getSessions: jest.fn(),
    deleteSession: jest.fn(),
    updateAvatar: jest.fn(),
    updateBanner: jest.fn(),
    deleteBanner: jest.fn(),
    getUserFollowers: jest.fn(),
    getUserFollowings: jest.fn(),
    getUserMutualFollowers: jest.fn(),
    getUserIdsFollowedBy: jest.fn(),
    getUsersRelationshipsMap: jest.fn(),
  };

  const mockEmailQueue = {
    add: jest.fn(),
  };

  const mockMediaService = {
    uploadAvatarOrBanner: jest.fn(),
    deleteMedia: jest.fn(),
    uploadAndSaveMedia: jest.fn(),
  };

  const mockContentParsingService = {
    parseContentForBio: jest.fn(),
  };

  const mockPrismaService = {
    $transaction: jest.fn(),
  };

  const mockDomainEventsService = {
    publish: jest.fn(),
    emitUserFollowed: jest.fn(),
    emitUserUnfollowed: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: mockRepository },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UsersService, useClass: UsersService },
        { provide: MediaService, useValue: mockMediaService },
        { provide: getQueueToken('email'), useValue: mockEmailQueue },
        { provide: MediaService, useValue: mockMediaService },
        { provide: ContentParsingService, useValue: mockContentParsingService },
        {
          provide: RedisService,
          useValue: { del: jest.fn(), safeIncr: jest.fn(), safeDecr: jest.fn() },
        },
        { provide: getQueueToken('timeline-following'), useValue: { add: jest.fn() } },
        { provide: DomainEventsService, useValue: mockDomainEventsService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  describe('findByUsername', () => {
    const mockUser = { id: BigInt(1), email: 'test@gmail.com', username: 'testuser' };

    it('should call the repository with the correct username and return its result', async () => {
      const username = 'testuser';
      mockRepository.findByUsername.mockResolvedValue(mockUser);

      const result = await service.findByUsername(username);

      expect(mockRepository.findByUsername).toHaveBeenCalledWith(username);
      expect(result).toBe(mockUser);
    });
  });

  describe('findByIdentifier', () => {
    const mockUser = { id: BigInt(1), email: 'test@gmail.com', username: 'testuser' };

    it('should call the repository with the correct identifier and return its result', async () => {
      const identifier = 'testuser';
      mockRepository.findByIdentifier.mockResolvedValue(mockUser);

      const result = await service.findByIdentifier(identifier);

      expect(mockRepository.findByIdentifier).toHaveBeenCalledWith(identifier);
      expect(result).toBe(mockUser);
    });
  });

  describe('updatePasswordById', () => {
    it('should call the repository with the correct userId and new password hash', async () => {
      const userId = BigInt(1);
      const newHashedPassword = 'newHashedPassword123';
      const expectedUpdatedUser = { id: userId, password_hash: newHashedPassword };

      mockRepository.updatePasswordById.mockResolvedValue(expectedUpdatedUser);

      const result = await service.updatePasswordById(userId, newHashedPassword);

      expect(mockRepository.updatePasswordById).toHaveBeenCalledWith(userId, newHashedPassword);
      expect(result).toEqual(expectedUpdatedUser);
    });
  });

  describe('findByEmail', () => {
    it('should call the repository with the correct email and return its result', async () => {
      const email = 'test@gmail.com';
      const expectedUser = { id: BigInt(1), email, password_hash: '...' };
      mockRepository.findByEmail.mockResolvedValue(expectedUser);

      const result = await service.findByEmail(email);

      expect(mockRepository.findByEmail).toHaveBeenCalledWith(email);
      expect(result).toBe(expectedUser);
    });
  });

  describe('createUser', () => {
    it('should call the repository with the correct user data and return the new user', async () => {
      const newUserDto: NewUser = {
        email: 'test@gmail.com',
        username: 'omar',
        name: 'Omar Gamal',
        passwordHash: 'hashedpassword',
        birthDate: new Date(),
        languageCode: LanguageCode.EN,
      };
      const expectedCreatedUser = { id: BigInt(2), ...newUserDto };
      mockRepository.createUser.mockResolvedValue(expectedCreatedUser);

      const result = await service.createUser(newUserDto, {} as never);

      expect(mockRepository.createUser).toHaveBeenCalledWith(newUserDto, {} as never);
      expect(result).toBe(expectedCreatedUser);
    });
  });

  describe('findByEmail', () => {
    it('should return a user by email', async () => {
      mockRepository.findByEmail.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockRepository.findByEmail).toHaveBeenCalledTimes(1);
    });

    it('should return null if user not found', async () => {
      mockRepository.findByEmail.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should return a user by username', async () => {
      mockRepository.findByUsername.mockResolvedValue(mockUser);

      const result = await service.findByUsername('testuser');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findByUsername).toHaveBeenCalledWith('testuser');
    });
  });

  describe('findByIdentifier', () => {
    it('should return a user by identifier', async () => {
      mockRepository.findByIdentifier.mockResolvedValue(mockUser);

      const result = await service.findByIdentifier('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findByIdentifier).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('createUser', () => {
    it('should create and return a new user', async () => {
      const userData = {
        email: 'newuser@example.com',
        username: 'newuser',
        passwordHash: 'NewPassword123!',
        name: 'New User',
        birthDate: new Date('2000-01-01'),
        languageCode: LanguageCode.EN,
      };

      mockRepository.createUser.mockResolvedValue({ ...userData, id: BigInt(2) });

      const result = await service.createUser(userData, {} as never);

      expect(result).toEqual({ ...userData, id: BigInt(2) });
      expect(mockRepository.createUser).toHaveBeenCalledWith(userData, expect.anything());
    });
  });

  describe('updatePasswordById', () => {
    it('should update user password', async () => {
      const userId = BigInt(1);
      const hashedPassword = 'newHashedPassword';

      mockRepository.updatePasswordById.mockResolvedValue({
        ...mockUser,
        password_hash: hashedPassword,
      });

      await service.updatePasswordById(userId, hashedPassword);

      expect(mockRepository.updatePasswordById).toHaveBeenCalledWith(userId, hashedPassword);
    });
  });

  describe('changePassword', () => {
    const changePasswordDto = {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!',
    } as ChangePasswordBasicDto;

    it('should successfully change password and send email', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(mockUser);
      mockComparePassword
        .mockResolvedValueOnce(true) // Current password matches
        .mockResolvedValueOnce(false); // New password is different
      mockHashPassword.mockResolvedValue('newHashedPassword123');

      // Act
      const result = await service.changePassword(BigInt(1), changePasswordDto);

      // Assert
      expect(result).toEqual({ message: 'Password changed successfully.' });
      expect(mockRepository.findById).toHaveBeenCalledWith(BigInt(1));
      expect(comparePassword).toHaveBeenNthCalledWith(1, 'OldPassword123!', mockUser.passwordHash);
      expect(comparePassword).toHaveBeenNthCalledWith(2, 'NewPassword123!', mockUser.passwordHash);

      expect(hashPassword).toHaveBeenCalledWith('NewPassword123!');
      expect(mockRepository.updatePasswordById).toHaveBeenCalledWith(
        BigInt(1),
        'newHashedPassword123',
      );

      expect(mockEmailQueue.add).toHaveBeenCalledWith('sendPasswordChangeEmail', {
        email: mockUser.email,
        username: mockUser.username,
        type: OtpType.CHANGE_PASSWORD,
      });
    });

    it('should throw error if user not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.changePassword(BigInt(1), changePasswordDto)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
            code: USERS_ERROR_CODES.USER_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw error if user has no password', async () => {
      const userWithoutPassword = { ...mockUser, password_hash: null };
      mockRepository.findById.mockResolvedValue(userWithoutPassword);

      await expect(service.changePassword(BigInt(1), changePasswordDto)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.INVALID_OLD_PASSWORD,
            code: USERS_ERROR_CODES.INVALID_OLD_PASSWORD,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw error if current password is invalid', async () => {
      mockRepository.findById.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValueOnce(false); // Current password does not match

      await expect(service.changePassword(BigInt(1), changePasswordDto)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.INVALID_OLD_PASSWORD,
            code: USERS_ERROR_CODES.INVALID_OLD_PASSWORD,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw error if new password is same as old password', async () => {
      mockRepository.findById.mockResolvedValue(mockUser);
      mockComparePassword
        .mockResolvedValueOnce(true) // Current password matches
        .mockResolvedValueOnce(true); // New password is same as old password

      await expect(service.changePassword(BigInt(1), changePasswordDto)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.NEW_PASSWORD_SAME_AS_OLD,
            code: USERS_ERROR_CODES.NEW_PASSWORD_SAME_AS_OLD,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw error if hashing fails', async () => {
      mockRepository.findById.mockResolvedValue(mockUser);
      mockComparePassword
        .mockResolvedValueOnce(true) // Current password matches
        .mockResolvedValueOnce(false); // New password is different
      mockHashPassword.mockRejectedValue(new Error('Hashing failed'));

      await expect(service.changePassword(BigInt(1), changePasswordDto)).rejects.toThrow(
        new Error('Hashing failed'),
      );
    });
  });

  describe('updateProfile', () => {
    const updateProfileDto: UpdateProfileDto = {
      displayName: 'Updated Name',
      bio: 'Updated bio',
      location: 'New Location',
      websiteUrl: 'https://newsite.com',
    };

    const mockFiles = {
      avatar: [
        {
          fieldname: 'avatar',
          originalname: 'avatar.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('fake-avatar-data'),
          size: 1024,
        } as Express.Multer.File,
      ],
      banner: [
        {
          fieldname: 'banner',
          originalname: 'banner.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('fake-banner-data'),
          size: 2048,
        } as Express.Multer.File,
      ],
    };

    test('should successfully update user profile with all fields provided', async () => {
      const updatedProfile = {
        ...updateProfileDto,
        updatedAt: new Date(),
      };

      mockRepository.findByIdWithProfile.mockResolvedValue(mockUser);
      mockContentParsingService.parseContentForBio.mockResolvedValue({
        mentions: [],
        hashtags: [],
      });
      mockPrismaService.$transaction.mockImplementation(
        <T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => {
          return callback({} as Prisma.TransactionClient);
        },
      );
      mockRepository.updateProfile.mockResolvedValue(updatedProfile);

      const { message, ...result } = await service.updateProfile(BigInt(1), updateProfileDto);

      expect(result).toEqual(updatedProfile);
      expect(message).toEqual('Profile updated successfully');
      expect(mockRepository.findByIdWithProfile).toHaveBeenCalledWith(BigInt(1));
    });

    test('should update only provided fields in user profile', async () => {
      const partialUpdateDto: UpdateProfileDto = {
        bio: 'Partially updated bio',
      };

      const updatedProfile = {
        ...mockUserProfile,
        ...partialUpdateDto,
        updatedAt: new Date(),
      };

      mockRepository.findByIdWithProfile.mockResolvedValue(mockUser);
      mockContentParsingService.parseContentForBio.mockResolvedValue({
        mentions: [],
        hashtags: [],
      });
      mockPrismaService.$transaction.mockImplementation(
        <T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => {
          return callback({} as Prisma.TransactionClient);
        },
      );

      mockRepository.updateProfile.mockResolvedValue(updatedProfile);

      const { message, ...result } = await service.updateProfile(BigInt(1), partialUpdateDto);
      expect(result).toEqual(updatedProfile);
      expect(message).toEqual('Profile updated successfully');
      expect(mockRepository.findByIdWithProfile).toHaveBeenCalledWith(BigInt(1));
      expect(mockRepository.updateProfile).toHaveBeenCalledWith(
        BigInt(1),
        partialUpdateDto,
        undefined,
        undefined,
        { mentions: [], hashtags: [] },
        {},
      );
    });

    test('should throw error if user not found', async () => {
      mockRepository.findByIdWithProfile.mockResolvedValue(null);

      await expect(service.updateProfile(BigInt(1), updateProfileDto)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
            code: USERS_ERROR_CODES.USER_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should handle empty update data', async () => {
      const emptyUpdateDto: UpdateProfileDto = {};
      mockRepository.findByIdWithProfile.mockResolvedValue(mockUser);
      mockPrismaService.$transaction.mockImplementation(
        <T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => {
          return callback({} as Prisma.TransactionClient);
        },
      );
      mockRepository.updateProfile.mockResolvedValue(mockUserProfile);

      const { message, ...result } = await service.updateProfile(BigInt(1), emptyUpdateDto);

      // No data to update, should return existing profile
      expect(result).toEqual(mockUserProfile);
      expect(message).toEqual('Profile updated successfully');
    });

    it('should successfully upload avatar and update profile', async () => {
      const avatarUrl = 'https://example.com/new-avatar.jpg';
      const updatedProfile = {
        ...updateProfileDto,
        avatarUrl,
        updatedAt: new Date(),
      };

      mockRepository.findByIdWithProfile.mockResolvedValue(mockUser);
      mockMediaService.uploadAvatarOrBanner.mockResolvedValue({ avatarUrl });
      mockContentParsingService.parseContentForBio.mockResolvedValue({
        mentions: [],
        hashtags: [],
      });
      mockPrismaService.$transaction.mockImplementation(
        <T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => {
          return callback({} as Prisma.TransactionClient);
        },
      );
      mockRepository.updateProfile.mockResolvedValue(updatedProfile);

      const { message, ...profile } = await service.updateProfile(BigInt(1), updateProfileDto, {
        avatar: mockFiles.avatar,
      });

      expect(profile).toEqual(updatedProfile);
      expect(message).toEqual('Profile updated successfully');
      expect(mockMediaService.uploadAvatarOrBanner).toHaveBeenCalledWith(BigInt(1), {
        avatar: mockFiles.avatar[0],
        banner: undefined,
      });
      expect(mockRepository.updateProfile).toHaveBeenCalledWith(
        BigInt(1),
        updateProfileDto,
        avatarUrl,
        undefined,
        { mentions: [], hashtags: [] },
        {},
      );
    });

    test('should successfully upload banner and update profile', async () => {
      const bannerUrl = 'https://example.com/new-banner.jpg';
      const updatedProfile = {
        ...updateProfileDto,
        bannerUrl,
        updatedAt: new Date(),
      };

      mockRepository.findByIdWithProfile.mockResolvedValue(mockUser);
      mockMediaService.uploadAvatarOrBanner.mockResolvedValue({ bannerUrl });
      mockContentParsingService.parseContentForBio.mockResolvedValue({
        mentions: [],
        hashtags: [],
      });
      mockPrismaService.$transaction.mockImplementation(
        <T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => {
          return callback({} as Prisma.TransactionClient);
        },
      );
      mockRepository.updateProfile.mockResolvedValue(updatedProfile);

      const { message, ...profile } = await service.updateProfile(BigInt(1), updateProfileDto, {
        banner: mockFiles.banner,
      });

      expect(profile).toEqual(updatedProfile);
      expect(message).toEqual('Profile updated successfully');
      expect(mockMediaService.uploadAvatarOrBanner).toHaveBeenCalledWith(BigInt(1), {
        avatar: undefined,
        banner: mockFiles.banner[0],
      });
      expect(mockRepository.updateProfile).toHaveBeenCalledWith(
        BigInt(1),
        updateProfileDto,
        undefined,
        bannerUrl,
        { mentions: [], hashtags: [] },
        {},
      );
    });

    test('should delete banner when deleteBanner is true', async () => {
      const updatedProfile = {
        ...updateProfileDto,
        bannerUrl: null,
        updatedAt: new Date(),
      };

      mockRepository.findByIdWithProfile.mockResolvedValue(mockUser);
      mockRepository.updateProfile.mockResolvedValue(updatedProfile);
      mockContentParsingService.parseContentForBio.mockResolvedValue({
        mentions: [],
        hashtags: [],
      });
      mockPrismaService.$transaction.mockImplementation(
        <T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => {
          return callback({} as Prisma.TransactionClient);
        },
      );

      const { message, ...profile } = await service.updateProfile(BigInt(1), {
        ...updateProfileDto,
        deleteBanner: true,
      });

      expect(profile).toEqual(updatedProfile);
      expect(message).toEqual('Profile updated successfully');
      expect(mockRepository.updateProfile).toHaveBeenCalledWith(
        BigInt(1),
        { ...updateProfileDto, deleteBanner: true },
        undefined,
        null,
        { mentions: [], hashtags: [] },
        {},
      );
    });

    test('should delete avatar when deleteAvatar is true', async () => {
      const updatedProfile = {
        ...updateProfileDto,
        avatarUrl: null,
        updatedAt: new Date(),
      };

      mockRepository.findByIdWithProfile.mockResolvedValue(mockUser);
      mockRepository.updateProfile.mockResolvedValue(updatedProfile);
      mockContentParsingService.parseContentForBio.mockResolvedValue({
        mentions: [],
        hashtags: [],
      });
      mockPrismaService.$transaction.mockImplementation(
        <T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => {
          return callback({} as Prisma.TransactionClient);
        },
      );

      const { message, ...profile } = await service.updateProfile(BigInt(1), {
        ...updateProfileDto,
        deleteAvatar: true,
      });

      expect(profile).toEqual(updatedProfile);
      expect(message).toEqual('Profile updated successfully');
      expect(mockRepository.updateProfile).toHaveBeenCalledWith(
        BigInt(1),
        { ...updateProfileDto, deleteAvatar: true },
        null,
        undefined,
        { mentions: [], hashtags: [] },
        {},
      );
    });

    test('should throw error when both deleteAvatar and avatar upload are requested', async () => {
      mockRepository.findByIdWithProfile.mockResolvedValue(mockUser);

      await expect(
        service.updateProfile(
          BigInt(1),
          { ...updateProfileDto, deleteAvatar: true },
          { avatar: mockFiles.avatar },
        ),
      ).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.INVALID_REQUEST_COMBINATION,
            code: USERS_ERROR_CODES.INVALID_REQUEST_COMBINATION,
          },
          HttpStatus.CONFLICT,
        ),
      );
    });

    test('should throw error when both deleteBanner and banner upload are requested', async () => {
      mockRepository.findByIdWithProfile.mockResolvedValue(mockUser);

      await expect(
        service.updateProfile(
          BigInt(1),
          { ...updateProfileDto, deleteBanner: true },
          { banner: mockFiles.banner },
        ),
      ).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.INVALID_REQUEST_COMBINATION,
            code: USERS_ERROR_CODES.INVALID_REQUEST_COMBINATION,
          },
          HttpStatus.CONFLICT,
        ),
      );
    });

    test('should rollback updated files when profile update fails', async () => {
      const avatarUrl = 'https://example.com/new-avatar.jpg';
      const bannerUrl = 'https://example.com/new-banner.jpg';

      mockRepository.findByIdWithProfile.mockResolvedValue(mockUser);
      mockMediaService.uploadAvatarOrBanner.mockResolvedValue({ avatarUrl, bannerUrl });
      mockMediaService.deleteMedia.mockResolvedValue(undefined);
      mockRepository.updateProfile.mockRejectedValue(new Error('Database error'));

      await expect(service.updateProfile(BigInt(1), updateProfileDto, mockFiles)).rejects.toThrow(
        'Database error',
      );

      expect(mockMediaService.uploadAvatarOrBanner).toHaveBeenCalledWith(BigInt(1), {
        avatar: mockFiles.avatar[0],
        banner: mockFiles.banner[0],
      });
      expect(mockMediaService.deleteMedia).toHaveBeenCalledWith(avatarUrl, BigInt(1));
      expect(mockMediaService.deleteMedia).toHaveBeenCalledWith(bannerUrl, BigInt(1));
      expect(mockMediaService.deleteMedia).toHaveBeenCalledTimes(2);
    });

    test('should delete old avatar and banner after successful DB update when new files uploaded', async () => {
      // Arrange
      const oldAvatarUrl = 'https://example.com/old-avatar.jpg';
      const oldBannerUrl = 'https://example.com/old-banner.jpg';
      const newAvatarUrl = 'https://example.com/new-avatar.jpg';
      const newBannerUrl = 'https://example.com/new-banner.jpg';

      mockRepository.findByIdWithProfile.mockResolvedValue({
        ...mockUser,
        profile: { avatarUrl: oldAvatarUrl, bannerUrl: oldBannerUrl },
      });
      mockMediaService.uploadAvatarOrBanner.mockResolvedValue({
        avatarUrl: newAvatarUrl,
        bannerUrl: newBannerUrl,
      });
      mockMediaService.deleteMedia.mockResolvedValue(undefined);
      const updatedProfile = {
        ...updateProfileDto,
        avatarUrl: newAvatarUrl,
        bannerUrl: newBannerUrl,
      };
      mockRepository.updateProfile.mockResolvedValue(updatedProfile);

      // Act
      const { message, ...profile } = await service.updateProfile(
        BigInt(1),
        updateProfileDto,
        mockFiles,
      );

      // Assert
      expect(profile).toEqual(updatedProfile);
      expect(message).toEqual('Profile updated successfully');
      // Verify old files are deleted after DB update
      expect(mockMediaService.deleteMedia).toHaveBeenCalledWith(oldAvatarUrl, BigInt(1));
      expect(mockMediaService.deleteMedia).toHaveBeenCalledWith(oldBannerUrl, BigInt(1));
    });

    test('should handle deletion of old avatar when new avatar is uploaded', async () => {
      // Arrange
      const oldAvatarUrl = 'https://example.com/old-avatar.jpg';
      const newAvatarUrl = 'https://example.com/new-avatar.jpg';

      mockRepository.findByIdWithProfile.mockResolvedValue({
        ...mockUser,
        profile: { avatarUrl: oldAvatarUrl, bannerUrl: undefined },
      });
      mockMediaService.uploadAvatarOrBanner.mockResolvedValue({
        avatarUrl: newAvatarUrl,
      });
      mockMediaService.deleteMedia.mockResolvedValue(undefined);
      const updatedProfile = {
        ...updateProfileDto,
        avatarUrl: newAvatarUrl,
      };
      mockRepository.updateProfile.mockResolvedValue(updatedProfile);

      // Act
      const { message, ...profile } = await service.updateProfile(BigInt(1), updateProfileDto, {
        avatar: mockFiles.avatar,
      });

      // Assert
      expect(profile).toEqual(updatedProfile);
      // Old avatar should be deleted
      expect(mockMediaService.deleteMedia).toHaveBeenCalledWith(oldAvatarUrl, BigInt(1));
      expect(message).toEqual('Profile updated successfully');
    });

    test('should delete old banner when explicit deleteBanner flag with existing banner', async () => {
      // Arrange
      const oldBannerUrl = 'https://example.com/old-banner.jpg';

      mockRepository.findByIdWithProfile.mockResolvedValue({
        ...mockUser,
        profile: { avatarUrl: undefined, bannerUrl: oldBannerUrl },
      });
      mockMediaService.deleteMedia.mockResolvedValue(undefined);
      const updatedProfile = {
        ...updateProfileDto,
        bannerUrl: null,
      };
      mockRepository.updateProfile.mockResolvedValue(updatedProfile);

      // Act
      const { message, ...profile } = await service.updateProfile(BigInt(1), {
        ...updateProfileDto,
        deleteBanner: true,
      });

      // Assert
      expect(profile).toEqual(updatedProfile);
      expect(mockMediaService.deleteMedia).toHaveBeenCalledWith(oldBannerUrl, BigInt(1));
      expect(message).toEqual('Profile updated successfully');
    });

    test('should delete old avatar when explicit deleteAvatar flag with existing avatar', async () => {
      // Arrange
      const oldAvatarUrl = 'https://example.com/old-avatar.jpg';

      mockRepository.findByIdWithProfile.mockResolvedValue({
        ...mockUser,
        profile: { avatarUrl: oldAvatarUrl, bannerUrl: undefined },
      });
      mockMediaService.deleteMedia.mockResolvedValue(undefined);
      const updatedProfile = {
        ...updateProfileDto,
        avatarUrl: null,
      };
      mockRepository.updateProfile.mockResolvedValue(updatedProfile);

      // Act
      const { message, ...profile } = await service.updateProfile(BigInt(1), {
        ...updateProfileDto,
        deleteAvatar: true,
      });

      // Assert
      expect(profile).toEqual(updatedProfile);
      expect(mockMediaService.deleteMedia).toHaveBeenCalledWith(oldAvatarUrl, BigInt(1));
      expect(message).toEqual('Profile updated successfully');
    });

    test('should not call deleteMedia when no old files exist', async () => {
      // Arrange
      mockRepository.findByIdWithProfile.mockResolvedValue({
        ...mockUser,
        profile: { avatarUrl: undefined, bannerUrl: undefined },
      });
      const updatedProfile = {
        ...updateProfileDto,
        avatarUrl: undefined,
        bannerUrl: undefined,
      };
      mockRepository.updateProfile.mockResolvedValue(updatedProfile);

      // Act
      const { message, ...profile } = await service.updateProfile(BigInt(1), updateProfileDto);

      // Assert
      expect(profile).toEqual(updatedProfile);
      expect(mockMediaService.deleteMedia).not.toHaveBeenCalled();
      expect(message).toEqual('Profile updated successfully');
    });

    test('should handle rollback with only avatar uploaded when upload succeeds but DB fails', async () => {
      const newAvatarUrl = 'https://example.com/new-avatar.jpg';

      mockRepository.findByIdWithProfile.mockResolvedValue({
        ...mockUser,
        profile: { avatarUrl: undefined, bannerUrl: undefined },
      });
      mockMediaService.uploadAvatarOrBanner.mockResolvedValue({
        avatarUrl: newAvatarUrl,
      });
      mockMediaService.deleteMedia.mockResolvedValue(undefined);
      mockRepository.updateProfile.mockRejectedValue(new Error('DB error'));

      await expect(
        service.updateProfile(BigInt(1), updateProfileDto, { avatar: mockFiles.avatar }),
      ).rejects.toThrow('DB error');

      // Only the newly uploaded avatar should be deleted in rollback
      expect(mockMediaService.deleteMedia).toHaveBeenCalledWith(newAvatarUrl, BigInt(1));
      expect(mockMediaService.deleteMedia).toHaveBeenCalledTimes(1);
    });

    test('should handle rollback with only banner uploaded when upload succeeds but DB fails', async () => {
      const newBannerUrl = 'https://example.com/new-banner.jpg';

      mockRepository.findByIdWithProfile.mockResolvedValue({
        ...mockUser,
        profile: { avatarUrl: undefined, bannerUrl: undefined },
      });
      mockMediaService.uploadAvatarOrBanner.mockResolvedValue({
        bannerUrl: newBannerUrl,
      });
      mockMediaService.deleteMedia.mockResolvedValue(undefined);
      mockRepository.updateProfile.mockRejectedValue(new Error('DB error'));

      await expect(
        service.updateProfile(BigInt(1), updateProfileDto, { banner: mockFiles.banner }),
      ).rejects.toThrow('DB error');

      // Only the newly uploaded banner should be deleted in rollback
      expect(mockMediaService.deleteMedia).toHaveBeenCalledWith(newBannerUrl, BigInt(1));
      expect(mockMediaService.deleteMedia).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUserProfile', () => {
    it('should return user profile without relationship data when currentUserId is not provided', async () => {
      const profileWithoutRelationship = { ...mockUserProfile, relationship: null };
      mockRepository.findUserProfileByUsername.mockResolvedValue(profileWithoutRelationship);

      const result = await service.getUserProfile('testuser');

      expect(result).toEqual(profileWithoutRelationship);
      expect(mockRepository.findUserProfileByUsername).toHaveBeenCalledWith(
        'testuser',
        undefined,
        false,
      );
    });

    it('should return user profile with relationship data when currentUserId is provided', async () => {
      const profileWithRelationship = {
        ...mockUserProfile,
        relationship: {
          blocking: false,
          blockedBy: false,
          following: true,
          follower: false,
          muted: false,
        },
      };

      mockRepository.findUserProfileByUsername.mockResolvedValue(profileWithRelationship);

      const result = await service.getUserProfile('testuser', BigInt(2));

      expect(result).toEqual(profileWithRelationship);
      expect(mockRepository.findUserProfileByUsername).toHaveBeenCalledWith(
        'testuser',
        BigInt(2),
        false,
      );
    });

    it('should throw error if user profile not found', async () => {
      mockRepository.findUserProfileByUsername.mockResolvedValue(null);

      await expect(service.getUserProfile('nonexistent')).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
            code: USERS_ERROR_CODES.USER_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );

      expect(mockRepository.findUserProfileByUsername).toHaveBeenCalledWith(
        'nonexistent',
        undefined,
        false,
      );
    });

    it('should include mutual followers when currentUserId is provided', async () => {
      const profileWithMutuals = {
        ...mockUserProfile,
        mutualsCount: 2,
        mutualUsers: ['Omar', 'Tasneem'],
      };

      mockRepository.findUserProfileByUsername.mockResolvedValue(profileWithMutuals);

      const result = await service.getUserProfile('testuser', BigInt(2));

      expect(result.mutualsCount).toBe(2);
      expect(result.mutualUsers).toEqual(['Omar', 'Tasneem']);
      expect(mockRepository.findUserProfileByUsername).toHaveBeenCalledWith(
        'testuser',
        BigInt(2),
        false,
      );
    });
  });

  describe('updateUsernameById', () => {
    it('should successfully update username', async () => {
      // Arrange
      const userId = BigInt(1);
      const newUsername = 'newusername';
      mockRepository.updateUsernameById.mockResolvedValue(undefined);

      // Act
      const result = await service.updateUsernameById(userId, newUsername);

      // Assert
      expect(result).toEqual({ message: 'Username updated successfully.' });
      expect(mockRepository.updateUsernameById).toHaveBeenCalledWith(userId, newUsername);
      expect(mockRepository.updateUsernameById).toHaveBeenCalledTimes(1);
    });

    it('should throw error if repository update fails', async () => {
      // Arrange
      const userId = BigInt(1);
      const newUsername = 'newusername';
      const error = new Error('Database error');
      mockRepository.updateUsernameById.mockRejectedValue(error);

      // Act & Assert
      await expect(service.updateUsernameById(userId, newUsername)).rejects.toThrow(
        'Database error',
      );
    });

    it('should handle case-only username changes', async () => {
      const userId = BigInt(1);
      const newUsername = 'TestUser';
      mockRepository.updateUsernameById.mockResolvedValue(undefined);

      const result = await service.updateUsernameById(userId, newUsername);

      expect(result).toEqual({ message: 'Username updated successfully.' });
      expect(mockRepository.updateUsernameById).toHaveBeenCalledWith(userId, newUsername);
    });

    it('should throw conflict when username is taken by another user', async () => {
      const userId = BigInt(1);
      const newUsername = 'takenusername';
      const error = new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USERNAME_ALREADY_USED,
          code: USERS_ERROR_CODES.USERNAME_ALREADY_USED,
        },
        HttpStatus.CONFLICT,
      );
      mockRepository.updateUsernameById.mockRejectedValue(error);

      await expect(service.updateUsernameById(userId, newUsername)).rejects.toThrow(error);
    });

    it('should throw not found when user does not exist', async () => {
      const userId = BigInt(999);
      const newUsername = 'newusername';
      const error = new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
      mockRepository.updateUsernameById.mockRejectedValue(error);

      await expect(service.updateUsernameById(userId, newUsername)).rejects.toThrow(error);
    });
  });

  describe('checkUsernameExistence', () => {
    it('should return null when username is available', async () => {
      const userId = '1';
      const username = 'availableusername';
      mockRepository.checkUsernameExistence.mockResolvedValue(null);

      const result = await service.checkUsernameExistence(userId, username);

      expect(result).toBeNull();
      expect(mockRepository.checkUsernameExistence).toHaveBeenCalledWith(userId, username);
    });

    it('should return null when username is the same as current user', async () => {
      const userId = '1';
      const username = 'currentusername';
      mockRepository.checkUsernameExistence.mockResolvedValue(null);

      const result = await service.checkUsernameExistence(userId, username);

      expect(result).toBeNull();
      expect(mockRepository.checkUsernameExistence).toHaveBeenCalledWith(userId, username);
    });

    it('should return null when username is case-only change for same user', async () => {
      const userId = '1';
      const username = 'CurrentUsername';
      mockRepository.checkUsernameExistence.mockResolvedValue(null);

      const result = await service.checkUsernameExistence(userId, username);

      expect(result).toBeNull();
    });

    it('should return user object when username is taken by another user', async () => {
      const userId = '1';
      const username = 'takenusername';
      const existingUser = {
        id: BigInt(2),
        email: 'other@example.com',
        username: 'takenusername',
        password_hash: 'hash',
      };
      mockRepository.checkUsernameExistence.mockResolvedValue(existingUser);

      const result = await service.checkUsernameExistence(userId, username);

      expect(result).toEqual(existingUser);
      expect(mockRepository.checkUsernameExistence).toHaveBeenCalledWith(userId, username);
    });

    it('should return user when checking case-insensitive conflict with another user', async () => {
      const userId = '1';
      const username = 'JohnDoe';
      const existingUser = {
        id: BigInt(2),
        email: 'john@example.com',
        username: 'johndoe',
        password_hash: 'hash',
      };
      mockRepository.checkUsernameExistence.mockResolvedValue(existingUser);

      const result = await service.checkUsernameExistence(userId, username);

      expect(result).toEqual(existingUser);
    });

    it('should throw not found when user does not exist', async () => {
      const userId = '999';
      const username = 'someusername';
      const error = new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
      mockRepository.checkUsernameExistence.mockRejectedValue(error);

      await expect(service.checkUsernameExistence(userId, username)).rejects.toThrow(error);
    });
  });

  describe('findById', () => {
    it('should return a user by id', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(mockUser);

      // Act
      const result = await service.findById(BigInt(1));

      // Assert
      expect(result).toEqual(mockUser);
      expect(mockRepository.findById).toHaveBeenCalledWith(BigInt(1));
      expect(mockRepository.findById).toHaveBeenCalledTimes(1);
    });

    it('should return null if user not found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(null);

      // Act
      const result = await service.findById(BigInt(999));

      // Assert
      expect(result).toBeNull();
      expect(mockRepository.findById).toHaveBeenCalledWith(BigInt(999));
    });
  });

  describe('updateUserEmail', () => {
    it('should successfully update user email when verified', async () => {
      // Arrange
      const userId = BigInt(1);
      const emailUpdateData = {
        userId: '1',
        otp: 'hashedOtp',
        newEmail: 'newemail@example.com',
        verified: true,
      };
      mockRepository.updateUserEmail.mockResolvedValue(undefined);

      // Act
      const result = await service.updateUserEmail(userId, emailUpdateData);

      // Assert
      expect(result).toBeUndefined();
      expect(mockRepository.updateUserEmail).toHaveBeenCalledWith(userId, emailUpdateData);
      expect(mockRepository.updateUserEmail).toHaveBeenCalledTimes(1);
    });

    it('should throw OtpFailedException if email update is not verified', async () => {
      // Arrange
      const userId = BigInt(1);
      const emailUpdateData = {
        userId: '1',
        otp: 'hashedOtp',
        newEmail: 'newemail@example.com',
        verified: false,
      };

      // Act & Assert
      await expect(service.updateUserEmail(userId, emailUpdateData)).rejects.toThrow();
    });

    it('should throw error if repository update fails', async () => {
      // Arrange
      const userId = BigInt(1);
      const emailUpdateData = {
        userId: '1',
        otp: 'hashedOtp',
        newEmail: 'newemail@example.com',
        verified: true,
      };
      const error = new Error('Database error');
      mockRepository.updateUserEmail.mockRejectedValue(error);

      // Act & Assert
      await expect(service.updateUserEmail(userId, emailUpdateData)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('followUser', () => {
    it('should find user by username and follow them', async () => {
      // Arrange
      const followerId = BigInt(2);
      const usernameToFollow = 'testuser';

      mockRepository.findByUsername.mockResolvedValue(mockUser);
      mockRepository.isFollowing.mockResolvedValue(false);
      mockRepository.isBlocked.mockResolvedValueOnce(false); // userBlockedYou
      mockRepository.isBlocked.mockResolvedValueOnce(false); // youBlockedUser
      mockRepository.followUser.mockResolvedValue(undefined);

      // Act
      const result = await service.followUser(followerId, usernameToFollow);

      // Assert
      expect(result).toEqual({ message: `User followed successfully.` });
      expect(mockRepository.findByUsername).toHaveBeenCalledWith(usernameToFollow);
      expect(mockRepository.isFollowing).toHaveBeenCalledWith(followerId, mockUser.id);
      expect(mockRepository.isBlocked).toHaveBeenNthCalledWith(1, mockUser.id, followerId);
      expect(mockRepository.isBlocked).toHaveBeenNthCalledWith(2, followerId, mockUser.id);
      expect(mockRepository.followUser).toHaveBeenCalledWith(followerId, mockUser.id);
    });

    it('should throw error if user to follow does not exist', async () => {
      // Arrange
      const followerId = BigInt(2);
      const usernameToFollow = 'nonexistentuser';

      mockRepository.findByUsername.mockResolvedValue(null);

      // Act & Assert
      await expect(service.followUser(followerId, usernameToFollow)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
            code: USERS_ERROR_CODES.USER_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw error if user id and followed user id are the same', async () => {
      // Arrange
      const followerId = BigInt(1);
      const usernameToFollow = 'testuser';

      mockRepository.findByUsername.mockResolvedValue({ ...mockUser, id: followerId });

      // Act & Assert
      await expect(service.followUser(followerId, usernameToFollow)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.CANNOT_FOLLOW_SELF,
            code: USERS_ERROR_CODES.CANNOT_FOLLOW_SELF,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw error if already following the user', async () => {
      // Arrange
      const followerId = BigInt(2);
      const usernameToFollow = 'testuser';

      mockRepository.findByUsername.mockResolvedValue(mockUser);
      mockRepository.isFollowing.mockResolvedValue(true);

      // Act & Assert
      await expect(service.followUser(followerId, usernameToFollow)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.ALREADY_FOLLOWING,
            code: USERS_ERROR_CODES.ALREADY_FOLLOWING,
          },
          HttpStatus.CONFLICT,
        ),
      );
    });

    it('should throw error if user blocked you', async () => {
      // Arrange
      const followerId = BigInt(2);
      const usernameToFollow = 'testuser';

      mockRepository.findByUsername.mockResolvedValue(mockUser);
      mockRepository.isFollowing.mockResolvedValue(false);
      mockRepository.isBlocked.mockResolvedValueOnce(true); // userBlockedYou

      // Act & Assert
      await expect(service.followUser(followerId, usernameToFollow)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.CANNOT_FOLLOW_USER,
            code: USERS_ERROR_CODES.CANNOT_FOLLOW_USER,
          },
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('should throw error if you have blocked the user', async () => {
      // Arrange
      const followerId = BigInt(2);
      const usernameToFollow = 'testuser';

      mockRepository.findByUsername.mockResolvedValue(mockUser);
      mockRepository.isFollowing.mockResolvedValue(false);
      mockRepository.isBlocked.mockResolvedValueOnce(false); // userBlockedYou
      mockRepository.isBlocked.mockResolvedValueOnce(true); // youBlockedUser

      // Act & Assert
      await expect(service.followUser(followerId, usernameToFollow)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.CANNOT_FOLLOW_USER,
            code: USERS_ERROR_CODES.CANNOT_FOLLOW_USER,
          },
          HttpStatus.FORBIDDEN,
        ),
      );
    });
  });

  describe('unfollowUser', () => {
    it('should unfollow a user successfully', async () => {
      // Arrange
      const followerId = BigInt(2);
      const usernameToUnfollow = 'testuser';

      mockRepository.findByUsername.mockResolvedValue(mockUser);
      mockRepository.isFollowing.mockResolvedValue(true);
      mockRepository.unfollowUser.mockResolvedValue(undefined);

      // Act
      const result = await service.unfollowUser(followerId, usernameToUnfollow);

      // Assert
      expect(result).toEqual({ message: `User unfollowed successfully.` });
      expect(mockRepository.findByUsername).toHaveBeenCalledWith(usernameToUnfollow);
      expect(mockRepository.isFollowing).toHaveBeenCalledWith(followerId, mockUser.id);
      expect(mockRepository.unfollowUser).toHaveBeenCalledWith(followerId, mockUser.id);
    });

    it('should throw error if user to unfollow does not exist', async () => {
      // Arrange
      const followerId = BigInt(2);
      const usernameToUnfollow = 'nonexistentuser';

      mockRepository.findByUsername.mockResolvedValue(null);

      // Act & Assert
      await expect(service.unfollowUser(followerId, usernameToUnfollow)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
            code: USERS_ERROR_CODES.USER_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw error if not following the user', async () => {
      // Arrange
      const followerId = BigInt(2);
      const usernameToUnfollow = 'testuser';

      mockRepository.findByUsername.mockResolvedValue(mockUser);
      mockRepository.isFollowing.mockResolvedValue(false);

      // Act & Assert
      await expect(service.unfollowUser(followerId, usernameToUnfollow)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.ALREADY_NOT_FOLLOWING,
            code: USERS_ERROR_CODES.ALREADY_NOT_FOLLOWING,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });
  });

  describe('blockUser', () => {
    it('should block a user successfully', async () => {
      // Arrange
      const blockerId = BigInt(2);
      const usernameToBlock = 'testuser';

      mockRepository.findByUsername.mockResolvedValue(mockUser);
      mockRepository.isBlocked.mockResolvedValue(false);
      mockRepository.blockUser.mockResolvedValue(undefined);

      // Act
      const result = await service.blockUser(blockerId, usernameToBlock);

      // Assert
      expect(result).toEqual({ message: `User blocked successfully.` });
      expect(mockRepository.findByUsername).toHaveBeenCalledWith(usernameToBlock);
      expect(mockRepository.isBlocked).toHaveBeenCalledWith(blockerId, mockUser.id);
      expect(mockRepository.blockUser).toHaveBeenCalledWith(blockerId, mockUser.id);
    });

    it('should throw error if user to block does not exist', async () => {
      // Arrange
      const blockerId = BigInt(2);
      const usernameToBlock = 'nonexistentuser';

      mockRepository.findByUsername.mockResolvedValue(null);

      // Act & Assert
      await expect(service.blockUser(blockerId, usernameToBlock)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
            code: USERS_ERROR_CODES.USER_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw error if already blocked the user', async () => {
      // Arrange
      const blockerId = BigInt(2);
      const usernameToBlock = 'testuser';

      mockRepository.findByUsername.mockResolvedValue(mockUser);
      mockRepository.isBlocked.mockResolvedValueOnce(true);

      // Act & Assert
      await expect(service.blockUser(blockerId, usernameToBlock)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.ALREADY_BLOCKED,
            code: USERS_ERROR_CODES.ALREADY_BLOCKED,
          },
          HttpStatus.CONFLICT,
        ),
      );
    });

    it('should throw error if trying to block self', async () => {
      // Arrange
      const blockerId = BigInt(1);
      const usernameToBlock = 'testuser';

      mockRepository.findByUsername.mockResolvedValue({ ...mockUser, id: blockerId });

      // Act & Assert
      await expect(service.blockUser(blockerId, usernameToBlock)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.CANNOT_BLOCK_SELF,
            code: USERS_ERROR_CODES.CANNOT_BLOCK_SELF,
          },
          HttpStatus.FORBIDDEN,
        ),
      );
    });
  });

  describe('unblockUser', () => {
    it('should unblock a user successfully', async () => {
      // Arrange
      const unblockerId = BigInt(2);
      const usernameToUnblock = 'testuser';

      mockRepository.findByUsername.mockResolvedValue(mockUser);
      mockRepository.isBlocked.mockResolvedValue(true);
      mockRepository.unblockUser.mockResolvedValue(undefined);

      // Act
      const result = await service.unblockUser(unblockerId, usernameToUnblock);

      // Assert
      expect(result).toEqual({ message: `User unblocked successfully.` });
      expect(mockRepository.findByUsername).toHaveBeenCalledWith(usernameToUnblock);
      expect(mockRepository.isBlocked).toHaveBeenCalledWith(unblockerId, mockUser.id);
      expect(mockRepository.unblockUser).toHaveBeenCalledWith(unblockerId, mockUser.id);
    });

    it('should throw error if user to unblock does not exist', async () => {
      // Arrange
      const unblockerId = BigInt(2);
      const usernameToUnblock = 'nonexistentuser';

      mockRepository.findByUsername.mockResolvedValue(null);

      // Act & Assert
      await expect(service.unblockUser(unblockerId, usernameToUnblock)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
            code: USERS_ERROR_CODES.USER_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw error if user is not blocked', async () => {
      // Arrange
      const unblockerId = BigInt(2);
      const usernameToUnblock = 'testuser';

      mockRepository.findByUsername.mockResolvedValue(mockUser);
      mockRepository.isBlocked.mockResolvedValue(false);

      // Act & Assert
      await expect(service.unblockUser(unblockerId, usernameToUnblock)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.NOT_BLOCKED,
            code: USERS_ERROR_CODES.NOT_BLOCKED,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });
  });

  describe('muteUser', () => {
    it('should mute a user successfully', async () => {
      // Arrange
      const muterId = BigInt(2);
      const usernameToMute = 'testuser';

      mockRepository.findByUsername.mockResolvedValue(mockUser);
      mockRepository.isMuted.mockResolvedValue(false);
      mockRepository.muteUser.mockResolvedValue(undefined);

      // Act
      const result = await service.muteUser(muterId, usernameToMute);

      // Assert
      expect(result).toEqual({ message: `User muted successfully.` });
      expect(mockRepository.findByUsername).toHaveBeenCalledWith(usernameToMute);
      expect(mockRepository.isMuted).toHaveBeenCalledWith(muterId, mockUser.id);
      expect(mockRepository.muteUser).toHaveBeenCalledWith(muterId, mockUser.id);
    });

    it('should throw error if user to mute does not exist', async () => {
      // Arrange
      const muterId = BigInt(2);
      const usernameToMute = 'nonexistentuser';

      mockRepository.findByUsername.mockResolvedValue(null);

      // Act & Assert
      await expect(service.muteUser(muterId, usernameToMute)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
            code: USERS_ERROR_CODES.USER_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw error if already muted the user', async () => {
      // Arrange
      const muterId = BigInt(2);
      const usernameToMute = 'testuser';

      mockRepository.findByUsername.mockResolvedValue(mockUser);
      mockRepository.isMuted.mockResolvedValue(true);

      // Act & Assert
      await expect(service.muteUser(muterId, usernameToMute)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.ALREADY_MUTED,
            code: USERS_ERROR_CODES.ALREADY_MUTED,
          },
          HttpStatus.CONFLICT,
        ),
      );
    });

    it('should throw error if trying to mute self', async () => {
      // Arrange
      const muterId = BigInt(1);
      const usernameToMute = 'testuser';

      mockRepository.findByUsername.mockResolvedValue({ ...mockUser, id: muterId });

      // Act & Assert
      await expect(service.muteUser(muterId, usernameToMute)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.CANNOT_MUTE_SELF,
            code: USERS_ERROR_CODES.CANNOT_MUTE_SELF,
          },
          HttpStatus.FORBIDDEN,
        ),
      );
    });
  });

  describe('unmuteUser', () => {
    it('should unmute a user successfully', async () => {
      // Arrange
      const unmuterId = BigInt(2);
      const usernameToUnmute = 'testuser';

      mockRepository.findByUsername.mockResolvedValue(mockUser);
      mockRepository.isMuted.mockResolvedValue(true);
      mockRepository.unmuteUser.mockResolvedValue(undefined);
      mockRepository.isBlocked.mockResolvedValue(false);

      // Act
      const result = await service.unmuteUser(unmuterId, usernameToUnmute);

      // Assert
      expect(result).toEqual({ message: `User unmuted successfully.` });
      expect(mockRepository.findByUsername).toHaveBeenCalledWith(usernameToUnmute);
      expect(mockRepository.isMuted).toHaveBeenCalledWith(unmuterId, mockUser.id);
      expect(mockRepository.unmuteUser).toHaveBeenCalledWith(unmuterId, mockUser.id);
    });

    it('should throw error if user to unmute does not exist', async () => {
      // Arrange
      const unmuterId = BigInt(2);
      const usernameToUnmute = 'nonexistentuser';

      mockRepository.findByUsername.mockResolvedValue(null);

      // Act & Assert
      await expect(service.unmuteUser(unmuterId, usernameToUnmute)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
            code: USERS_ERROR_CODES.USER_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw error if user is not muted', async () => {
      // Arrange
      const unmuterId = BigInt(2);
      const usernameToUnmute = 'testuser';

      mockRepository.findByUsername.mockResolvedValue(mockUser);
      mockRepository.isMuted.mockResolvedValue(false);
      mockRepository.isBlocked.mockResolvedValue(false);

      // Act & Assert
      await expect(service.unmuteUser(unmuterId, usernameToUnmute)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.NOT_MUTED,
            code: USERS_ERROR_CODES.NOT_MUTED,
          },
          HttpStatus.NOT_FOUND,
        ),
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

      mockRepository.getUserDetails.mockResolvedValue(expectedDetails);

      // Act
      const result = await service.getUserDetails(userId);

      // Assert
      expect(result).toEqual(expectedDetails);
      expect(mockRepository.getUserDetails).toHaveBeenCalledWith(userId);
      expect(mockRepository.getUserDetails).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateBirthDate', () => {
    it('should update birth date successfully', async () => {
      // Arrange
      const userId = BigInt(1);
      const birthDate = new Date('1995-05-15');
      const expectedResult = { message: 'Birth date updated successfully.' };

      mockRepository.updateBirthDate.mockResolvedValue(expectedResult);

      // Act
      const result = await service.updateBirthDate(userId, birthDate);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockRepository.updateBirthDate).toHaveBeenCalledWith(userId, birthDate);
      expect(mockRepository.updateBirthDate).toHaveBeenCalledTimes(1);
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

      mockRepository.getUserSSOs.mockResolvedValue(expectedSSOs);

      // Act
      const result = await service.getUserSSOs(userId);

      // Assert
      expect(result).toEqual(expectedSSOs);
      expect(mockRepository.getUserSSOs).toHaveBeenCalledWith(userId);
      expect(mockRepository.getUserSSOs).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateLoggedInUser', () => {
    it('should return true for correct password', async () => {
      // Arrange
      const userId = BigInt(1);
      const currentPassword = 'correctPassword123';

      mockRepository.validateLoggedInUser.mockResolvedValue(true);

      // Act
      const result = await service.validateLoggedInUser(userId, currentPassword);

      // Assert
      expect(result).toBe(true);
      expect(mockRepository.validateLoggedInUser).toHaveBeenCalledWith(userId, currentPassword);
    });

    it('should return false for incorrect password', async () => {
      // Arrange
      const userId = BigInt(1);
      const currentPassword = 'wrongPassword';

      mockRepository.validateLoggedInUser.mockResolvedValue(false);

      // Act
      const result = await service.validateLoggedInUser(userId, currentPassword);

      // Assert
      expect(result).toBe(false);
      expect(mockRepository.validateLoggedInUser).toHaveBeenCalledWith(userId, currentPassword);
    });
  });

  describe('removeUserSSO', () => {
    it('should remove user SSO successfully with correct password', async () => {
      // Arrange
      const userId = BigInt(1);
      const provider = 'google';
      const currentPassword = 'correctPassword123';

      mockRepository.validateLoggedInUser.mockResolvedValue(true);
      mockRepository.removeUserSSO.mockResolvedValue(undefined);

      // Act
      const result = await service.removeUserSSO(userId, provider, currentPassword);

      // Assert
      expect(result).toEqual({ message: 'Account disconnected successfully.' });
      expect(mockRepository.validateLoggedInUser).toHaveBeenCalledWith(userId, currentPassword);
      expect(mockRepository.removeUserSSO).toHaveBeenCalledWith(userId, provider);
    });

    it('should throw error if password is incorrect', async () => {
      // Arrange
      const userId = BigInt(1);
      const provider = 'google';
      const currentPassword = 'wrongPassword';

      mockRepository.validateLoggedInUser.mockResolvedValue(false);

      // Act & Assert
      await expect(service.removeUserSSO(userId, provider, currentPassword)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.INVALID_PASSWORD,
            code: USERS_ERROR_CODES.INVALID_PASSWORD,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );

      expect(mockRepository.validateLoggedInUser).toHaveBeenCalledWith(userId, currentPassword);
      expect(mockRepository.removeUserSSO).not.toHaveBeenCalled();
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

      mockRepository.getCountries.mockResolvedValue(expectedCountries);

      // Act
      const result = await service.getCountries();

      // Assert
      expect(result).toEqual(expectedCountries);
      expect(mockRepository.getCountries).toHaveBeenCalled();
      expect(mockRepository.getCountries).toHaveBeenCalledTimes(1);
    });
  });

  describe('changeCountry', () => {
    it('should change country successfully', async () => {
      // Arrange
      const userId = BigInt(1);
      const countryName = 'Egypt';
      const countryData = { id: 1, name: 'Egypt', code: 'EG' };

      mockRepository.checkCountry.mockResolvedValue(countryData);
      mockRepository.updateCountry.mockResolvedValue(undefined);

      // Act
      const result = await service.changeCountry(userId, countryName);

      // Assert
      expect(result).toEqual({ message: 'Country updated successfully.' });
      expect(mockRepository.checkCountry).toHaveBeenCalledWith(countryName);
      expect(mockRepository.updateCountry).toHaveBeenCalledWith(userId, countryData);
    });

    it('should throw error if country is not found', async () => {
      // Arrange
      const userId = BigInt(1);
      const countryName = 'InvalidCountry';
      const error = new HttpException('Country not found', HttpStatus.BAD_REQUEST);

      mockRepository.checkCountry.mockRejectedValue(error);

      // Act & Assert
      await expect(service.changeCountry(userId, countryName)).rejects.toThrow(error);
      expect(mockRepository.checkCountry).toHaveBeenCalledWith(countryName);
      expect(mockRepository.updateCountry).not.toHaveBeenCalled();
    });
  });

  describe('updateGender', () => {
    it('should update gender successfully', async () => {
      // Arrange
      const userId = BigInt(1);
      const gender = 'Male';

      mockRepository.updateGender.mockResolvedValue(undefined);

      // Act
      const result = await service.updateGender(userId, gender);

      // Assert
      expect(result).toEqual({ message: 'Gender updated successfully.' });
      expect(mockRepository.updateGender).toHaveBeenCalledWith(userId, gender);
      expect(mockRepository.updateGender).toHaveBeenCalledTimes(1);
    });

    it('should update gender to Female', async () => {
      // Arrange
      const userId = BigInt(1);
      const gender = 'Female';

      mockRepository.updateGender.mockResolvedValue(undefined);

      // Act
      const result = await service.updateGender(userId, gender);

      // Assert
      expect(result).toEqual({ message: 'Gender updated successfully.' });
      expect(mockRepository.updateGender).toHaveBeenCalledWith(userId, gender);
    });
  });

  describe('updateLanguage', () => {
    it('should update language successfully', async () => {
      // Arrange
      const userId = BigInt(1);
      const language = 'EN';

      mockRepository.updateLanguage.mockResolvedValue(undefined);

      // Act
      const result = await service.updateLanguage(userId, language);

      // Assert
      expect(result).toEqual({ message: 'Default language updated successfully.' });
      expect(mockRepository.updateLanguage).toHaveBeenCalledWith(userId, language);
      expect(mockRepository.updateLanguage).toHaveBeenCalledTimes(1);
    });

    it('should update language to Arabic', async () => {
      // Arrange
      const userId = BigInt(1);
      const language = 'AR';

      mockRepository.updateLanguage.mockResolvedValue(undefined);

      // Act
      const result = await service.updateLanguage(userId, language);

      // Assert
      expect(result).toEqual({ message: 'Default language updated successfully.' });
      expect(mockRepository.updateLanguage).toHaveBeenCalledWith(userId, language);
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

      mockRepository.getSessions.mockResolvedValue(expectedSessions);

      // Act
      const result = await service.getSessions(userId, refreshToken);

      // Assert
      expect(result).toEqual(expectedSessions);
      expect(mockRepository.getSessions).toHaveBeenCalledWith(userId, refreshToken);
      expect(mockRepository.getSessions).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteSession', () => {
    it('should delete session successfully', async () => {
      // Arrange
      const userId = BigInt(1);
      const sessionId = BigInt(2);
      const refreshToken = 'valid-refresh-token';

      mockRepository.deleteSession.mockResolvedValue(undefined);

      // Act
      const result = await service.deleteSession(userId, sessionId, refreshToken);

      // Assert
      expect(result).toEqual({ message: 'Session terminated successfully.' });
      expect(mockRepository.deleteSession).toHaveBeenCalledWith(userId, sessionId, refreshToken);
      expect(mockRepository.deleteSession).toHaveBeenCalledTimes(1);
    });

    it('should throw error if session deletion fails', async () => {
      // Arrange
      const userId = BigInt(1);
      const sessionId = BigInt(2);
      const refreshToken = 'valid-refresh-token';
      const error = new Error('Session not found');

      mockRepository.deleteSession.mockRejectedValue(error);

      // Act & Assert
      await expect(service.deleteSession(userId, sessionId, refreshToken)).rejects.toThrow(error);
      expect(mockRepository.deleteSession).toHaveBeenCalledWith(userId, sessionId, refreshToken);
    });
  });

  describe('uploadAvatar', () => {
    const avatar = {
      fieldname: 'avatar',
      originalname: 'avatar.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('fake-avatar-data'),
      size: 1024,
    } as Express.Multer.File;

    it('should update avatar successfully and return avatar url', async () => {
      // Arrange
      const userId = BigInt(1);
      const avatarUrl = 'https://example.com/new-avatar.jpg';
      mockRepository.updateAvatar.mockResolvedValue(undefined);
      mockMediaService.uploadAndSaveMedia.mockResolvedValue({ url: avatarUrl });

      // Act
      const result = await service.uploadAvatar(userId, avatar);

      // Assert
      expect(result).toEqual({ avatarUrl, message: 'Avatar uploaded successfully' });
      expect(mockRepository.updateAvatar).toHaveBeenCalledWith(userId, avatarUrl);
      expect(mockMediaService.uploadAndSaveMedia).toHaveBeenCalledWith(
        avatar,
        userId,
        MediaFolder.AVATARS,
      );
    });

    it('should throw error if media upload fails', async () => {
      // Arrange
      const userId = BigInt(1);
      const error = new Error('Media upload failed');
      mockMediaService.uploadAndSaveMedia.mockRejectedValue(error);

      // Act & Assert
      await expect(service.uploadAvatar(userId, avatar)).rejects.toThrow('Media upload failed');
    });
  });

  describe('uploadBanner', () => {
    const banner = {
      fieldname: 'banner',
      originalname: 'banner.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('fake-banner-data'),
      size: 2048,
    } as Express.Multer.File;

    it('should update banner successfully and return banner url', async () => {
      // Arrange
      const userId = BigInt(1);
      const bannerUrl = 'https://example.com/new-banner.jpg';
      mockRepository.updateBanner.mockResolvedValue(undefined);
      mockMediaService.uploadAndSaveMedia.mockResolvedValue({ url: bannerUrl });

      // Act
      const result = await service.uploadBanner(userId, banner);

      // Assert
      expect(result).toEqual({ bannerUrl, message: 'Banner uploaded successfully' });
      expect(mockRepository.updateBanner).toHaveBeenCalledWith(userId, bannerUrl);
      expect(mockMediaService.uploadAndSaveMedia).toHaveBeenCalledWith(
        banner,
        userId,
        MediaFolder.BANNERS,
      );
    });

    it('should throw error if media upload fails', async () => {
      // Arrange
      const userId = BigInt(1);
      const error = new Error('Media upload failed');
      mockMediaService.uploadAndSaveMedia.mockRejectedValue(error);

      // Act & Assert
      await expect(service.uploadBanner(userId, banner)).rejects.toThrow('Media upload failed');
    });
  });

  describe('deleteBanner', () => {
    it('should delete banner successfully', async () => {
      // Arrange
      const userId = BigInt(1);
      const mockBannerUrl = 'https://example.com/existing-banner.jpg';
      mockRepository.deleteBanner.mockResolvedValue({ bannerUrl: mockBannerUrl });

      // Act
      const result = await service.deleteBanner(userId);

      // Assert
      expect(result).toEqual({ message: 'Banner deleted successfully' });
      expect(mockRepository.deleteBanner).toHaveBeenCalledWith(userId);
    });

    it('should throw error if repository delete fails', async () => {
      // Arrange
      const userId = BigInt(1);
      const error = new Error('Database error');
      mockRepository.deleteBanner.mockRejectedValue(error);

      // Act & Assert
      await expect(service.deleteBanner(userId)).rejects.toThrow('Database error');
    });
  });

  describe('getUserFollowers', () => {
    const mockUsername = 'testuser';
    const authUserId = BigInt(100);
    const requestedUserId = BigInt(1);
    const limit = 2;

    // Helper to encode a valid cursor
    const encodeValidCursor = (followerId: string, followedId: string): string => {
      const cursorObj = { followerId, followedId };
      return Buffer.from(JSON.stringify(cursorObj)).toString('base64');
    };

    beforeEach(() => {
      // Mock the requested user lookup
      mockRepository.findByUsername.mockResolvedValue({
        id: requestedUserId,
        username: mockUsername,
      });
    });

    it('should return followers without cursor (first page)', async () => {
      // Arrange: 3 followers returned (limit+1 to detect hasNextPage)
      const mockFollowers = [
        {
          followerId: BigInt(2),
          followedId: requestedUserId,
          followerUser: {
            id: BigInt(2),
            username: 'follower1',
            profile: { displayName: 'Follower One', bio: 'Bio 1' },
          },
        },
        {
          followerId: BigInt(3),
          followedId: requestedUserId,
          followerUser: {
            id: BigInt(3),
            username: 'follower2',
            profile: { displayName: 'Follower Two', bio: 'Bio 2' },
          },
        },
        {
          followerId: BigInt(4),
          followedId: requestedUserId,
          followerUser: {
            id: BigInt(4),
            username: 'follower3',
            profile: { displayName: 'Follower Three', bio: 'Bio 3' },
          },
        },
      ];

      mockRepository.getUserFollowers.mockResolvedValue(mockFollowers);
      mockRepository.getUsersRelationshipsMap.mockResolvedValue(
        new Map<bigint, UserRelationshipDto>([
          [
            BigInt(2),
            { following: false, follower: true, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(3),
            { following: true, follower: false, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(4),
            {
              following: false,
              follower: false,
              blockedBy: false,
              blocking: false,
              muted: false,
            },
          ],
        ]),
      );

      // Act
      const result = await service.getUserFollowers(mockUsername, authUserId, limit);

      // Assert
      expect(mockRepository.findByUsername).toHaveBeenCalledWith(mockUsername);
      expect(mockRepository.getUserFollowers).toHaveBeenCalledWith(
        requestedUserId,
        limit + 1,
        undefined, // no cursor decoded
      );

      expect(mockRepository.getUsersRelationshipsMap).toHaveBeenCalledWith(authUserId, [
        BigInt(2),
        BigInt(3),
      ]);

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({
        displayName: 'Follower One',
        username: 'follower1',
        relationship: {
          following: false,
          follower: true,
          blockedBy: false,
          blocking: false,
          muted: false,
        },
      });
      expect(result.items[1]).toMatchObject({
        displayName: 'Follower Two',
        username: 'follower2',
        relationship: {
          following: true,
          follower: false,
          blockedBy: false,
          blocking: false,
          muted: false,
        },
      });

      // Pagination should indicate next page
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.nextCursor).toBeTruthy();
    });

    it('should return followers with valid cursor (subsequent page)', async () => {
      // Arrange
      const validCursor = encodeValidCursor('2', '1'); // followerId=2, followedId=1
      const mockFollowers = [
        {
          followerId: BigInt(5),
          followedId: requestedUserId,
          followerUser: {
            id: BigInt(5),
            username: 'follower5',
            profile: { displayName: 'Follower Five', bio: 'Bio 5' },
          },
        },
        {
          followerId: BigInt(6),
          followedId: requestedUserId,
          followerUser: {
            id: BigInt(6),
            username: 'follower6',
            profile: { displayName: 'Follower Six', bio: 'Bio 6' },
          },
        },
      ];

      mockRepository.getUsersRelationshipsMap.mockResolvedValue(
        new Map<bigint, UserRelationshipDto>([
          [
            BigInt(2),
            { following: false, follower: true, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(3),
            { following: true, follower: false, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(4),
            {
              following: false,
              follower: false,
              blockedBy: false,
              blocking: false,
              muted: false,
            },
          ],
        ]),
      );
      mockRepository.getUserFollowers.mockResolvedValue(mockFollowers);

      // Act
      const result = await service.getUserFollowers(mockUsername, authUserId, limit, validCursor);

      // Assert
      expect(mockRepository.getUserFollowers).toHaveBeenCalledWith(
        requestedUserId,
        limit + 1,
        { followerId: '2', followedId: '1' }, // decoded cursor
      );

      expect(result.items).toHaveLength(2);
      expect(result.pagination.cursor).toBe(validCursor); // prevCursor echoed back
      expect(result.pagination.hasNextPage).toBe(false); // only 2 items, no extra
    });

    it('should throw BadRequest for invalid cursor format', async () => {
      // Arrange: a cursor that is not valid base64 JSON
      const invalidCursor = 'not-valid-base64!!!';

      // Act & Assert
      await expect(
        service.getUserFollowers(mockUsername, authUserId, limit, invalidCursor),
      ).rejects.toThrow(HttpException);

      await expect(
        service.getUserFollowers(mockUsername, authUserId, limit, invalidCursor),
      ).rejects.toMatchObject({
        response: {
          message: 'Invalid cursor format',
          code: 'INVALID_FORMAT',
        },
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('should flag blocked and muted users in the response', async () => {
      // Arrange
      const mockFollowers = [
        {
          followerId: BigInt(2),
          followedId: requestedUserId,
          followerUser: {
            id: BigInt(2),
            username: 'follower1',
            profile: { displayName: 'Follower One' },
          },
        },
        {
          followerId: BigInt(3),
          followedId: requestedUserId,
          followerUser: {
            id: BigInt(3),
            username: 'follower2',
            profile: { displayName: 'Follower Two' },
          },
        },
      ];

      mockRepository.getUserFollowers.mockResolvedValue(mockFollowers);
      mockRepository.getUsersRelationshipsMap.mockResolvedValue(
        new Map<bigint, UserRelationshipDto>([
          [
            BigInt(2),
            { following: false, follower: true, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(3),
            { following: true, follower: false, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(4),
            {
              following: false,
              follower: false,
              blockedBy: false,
              blocking: false,
              muted: false,
            },
          ],
        ]),
      );

      // Act
      const result = await service.getUserFollowers(mockUsername, authUserId, limit);

      // Assert
      expect(result.items[0].relationship.blocking).toBe(false); // follower1 is blocked
      expect(result.items[1].relationship.blocking).toBe(false); // follower2 is not blocked
    });

    it('should correctly set isFollowing flag based on user follows Relation ', async () => {
      // Arrange
      const mockFollowers = [
        {
          followerId: BigInt(2),
          followedId: requestedUserId,
          followerUser: {
            id: BigInt(2),
            username: 'follower1',
            profile: { displayName: 'Follower One' },
          },
        },
        {
          followerId: BigInt(3),
          followedId: requestedUserId,
          followerUser: {
            id: BigInt(3),
            username: 'follower2',
            profile: { displayName: 'Follower Two' },
          },
        },
      ];

      mockRepository.getUserFollowers.mockResolvedValue(mockFollowers);

      mockRepository.getUsersRelationshipsMap.mockResolvedValue(
        new Map<bigint, UserRelationshipDto>([
          [
            BigInt(2),
            { following: false, follower: true, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(3),
            { following: true, follower: false, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(4),
            {
              following: false,
              follower: false,
              blockedBy: false,
              blocking: false,
              muted: false,
            },
          ],
        ]),
      );
      // Act
      const result = await service.getUserFollowers(mockUsername, authUserId, limit);

      // Assert
      expect(result.items[0].relationship.following).toBe(false); // follower1 not followed back
      expect(result.items[0].relationship.follower).toBe(true); // follower1 doesn't follows auth user
      expect(result.items[1].relationship.following).toBe(true); // follower2 followed back
      expect(result.items[1].relationship.follower).toBe(false); // follower2 follow auth user
    });

    it('should throw NOT_FOUND if requested user does not exist', async () => {
      // Arrange
      mockRepository.findByUsername.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getUserFollowers(mockUsername, authUserId, limit)).rejects.toThrow(
        HttpException,
      );

      await expect(service.getUserFollowers(mockUsername, authUserId, limit)).rejects.toMatchObject(
        {
          response: {
            message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
            code: USERS_ERROR_CODES.USER_NOT_FOUND,
          },
          status: HttpStatus.NOT_FOUND,
        },
      );
    });

    it('should return empty items when user has no followers', async () => {
      // Arrange
      mockRepository.getUserFollowers.mockResolvedValue([]);
      mockRepository.getUsersRelationshipsMap.mockResolvedValue(
        new Map<bigint, UserRelationshipDto>([
          [
            BigInt(2),
            { following: false, follower: true, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(3),
            { following: true, follower: false, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(4),
            {
              following: false,
              follower: false,
              blockedBy: false,
              blocking: false,
              muted: false,
            },
          ],
        ]),
      );

      // Act
      const result = await service.getUserFollowers(mockUsername, authUserId, limit);

      // Assert
      expect(result.items).toEqual([]);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.nextCursor).toBeNull();
    });
  });

  describe('getUserFollowings', () => {
    const mockUsername = 'testuser';
    const authUserId = BigInt(100);
    const requestedUserId = BigInt(1);
    const limit = 2;

    // Helper to encode a valid cursor
    const encodeValidCursor = (followerId: string, followedId: string): string => {
      const cursorObj = { followerId, followedId };
      return Buffer.from(JSON.stringify(cursorObj)).toString('base64');
    };

    beforeEach(() => {
      // Mock the requested user lookup
      mockRepository.findByUsername.mockResolvedValue({
        id: requestedUserId,
        username: mockUsername,
      });
    });

    it('should return followings without cursor (first page)', async () => {
      // Arrange: 3 followings returned (limit+1 to detect hasNextPage)
      const mockFollowings = [
        {
          followerId: requestedUserId,
          followedId: BigInt(2),
          followedUser: {
            id: BigInt(2),
            username: 'followed1',
            profile: { displayName: 'Followed One', bio: 'Bio 1' },
          },
        },
        {
          followerId: requestedUserId,
          followedId: BigInt(3),
          followedUser: {
            id: BigInt(3),
            username: 'followed2',
            profile: { displayName: 'Followed Two', bio: 'Bio 2' },
          },
        },
        {
          followerId: requestedUserId,
          followedId: BigInt(4),
          followedUser: {
            id: BigInt(4),
            username: 'followed3',
            profile: { displayName: 'Followed Three', bio: 'Bio 3' },
          },
        },
      ];

      mockRepository.getUserFollowings.mockResolvedValue(mockFollowings);

      mockRepository.getUsersRelationshipsMap.mockResolvedValue(
        new Map<bigint, UserRelationshipDto>([
          [
            BigInt(2),
            { following: false, follower: false, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(3),
            { following: false, follower: false, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(4),
            {
              following: false,
              follower: false,
              blockedBy: false,
              blocking: false,
              muted: false,
            },
          ],
        ]),
      );
      // Act
      const result = await service.getUserFollowings(mockUsername, authUserId, limit);

      // Assert
      expect(mockRepository.findByUsername).toHaveBeenCalledWith(mockUsername);
      expect(mockRepository.getUserFollowings).toHaveBeenCalledWith(
        requestedUserId,
        limit + 1,
        undefined, // no cursor decoded
      );
      // Note: paginateComposite removes the extra item, so only first 2 follower IDs are passed
      expect(mockRepository.getUsersRelationshipsMap).toHaveBeenCalledWith(authUserId, [
        BigInt(2),
        BigInt(3),
      ]);

      // Only first 2 items returned (limit=2), third is used for pagination
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({
        displayName: 'Followed One',
        username: 'followed1',
        relationship: {
          following: false,
          follower: false,
          blockedBy: false,
          blocking: false,
          muted: false,
        },
      });
      expect(result.items[1]).toMatchObject({
        displayName: 'Followed Two',
        username: 'followed2',
        relationship: {
          following: false,
          follower: false,
          blockedBy: false,
          blocking: false,
          muted: false,
        },
      });

      // Pagination should indicate next page
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.nextCursor).toBeTruthy();
    });

    it('should return followings with valid cursor (subsequent page)', async () => {
      // Arrange
      const validCursor = encodeValidCursor('2', '1'); // followerId=2, followedId=1
      const mockFollowings = [
        {
          followerId: requestedUserId,
          followedId: BigInt(5),
          followedUser: {
            id: BigInt(5),
            username: 'followed5',
            profile: { displayName: 'Followed Five', bio: 'Bio 5' },
          },
        },
        {
          followedId: BigInt(6),
          followerId: requestedUserId,
          followedUser: {
            id: BigInt(6),
            username: 'followed6',
            profile: { displayName: 'Followed Six', bio: 'Bio 6' },
          },
        },
      ];

      mockRepository.getUserFollowings.mockResolvedValue(mockFollowings);

      mockRepository.getUsersRelationshipsMap.mockResolvedValue(
        new Map<bigint, UserRelationshipDto>([
          [
            BigInt(2),
            { following: false, follower: true, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(3),
            { following: true, follower: false, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(4),
            {
              following: false,
              follower: false,
              blockedBy: false,
              blocking: false,
              muted: false,
            },
          ],
        ]),
      );

      // Act
      const result = await service.getUserFollowings(mockUsername, authUserId, limit, validCursor);

      // Assert
      expect(mockRepository.getUserFollowings).toHaveBeenCalledWith(
        requestedUserId,
        limit + 1,
        { followerId: '2', followedId: '1' }, // decoded cursor
      );

      expect(result.items).toHaveLength(2);
      expect(result.pagination.cursor).toBe(validCursor); // prevCursor echoed back
      expect(result.pagination.hasNextPage).toBe(false); // only 2 items, no extra
    });

    it('should throw BadRequest for invalid cursor format', async () => {
      // Arrange: a cursor that is not valid base64 JSON
      const invalidCursor = 'not-valid-base64!!!';

      // Act & Assert
      await expect(
        service.getUserFollowings(mockUsername, authUserId, limit, invalidCursor),
      ).rejects.toThrow(HttpException);

      await expect(
        service.getUserFollowings(mockUsername, authUserId, limit, invalidCursor),
      ).rejects.toMatchObject({
        response: {
          message: 'Invalid cursor format',
          code: 'INVALID_FORMAT',
        },
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('should flag blocked and muted users in the response', async () => {
      // Arrange
      const mockFollowings = [
        {
          followerId: requestedUserId,
          followedId: BigInt(2),
          followedUser: {
            id: BigInt(2),
            username: 'followed1',
            profile: { displayName: 'Followed One' },
          },
        },
        {
          followerId: requestedUserId,
          followedId: BigInt(3),
          followedUser: {
            id: BigInt(3),
            username: 'followed2',
            profile: { displayName: 'Followed Two' },
          },
        },
      ];

      mockRepository.getUserFollowings.mockResolvedValue(mockFollowings);

      mockRepository.getUsersRelationshipsMap.mockResolvedValue(
        new Map<bigint, UserRelationshipDto>([
          [
            BigInt(2),
            { following: false, follower: true, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(3),
            { following: true, follower: false, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(4),
            {
              following: false,
              follower: false,
              blockedBy: false,
              blocking: false,
              muted: false,
            },
          ],
        ]),
      );
      // Act
      const result = await service.getUserFollowings(mockUsername, authUserId, limit);

      // Assert
      expect(result.items[0].relationship.blocking).toBe(false); // followed1 is blocked
      expect(result.items[1].relationship.blocking).toBe(false); // followed2 is not blocked
      expect(result.items[0].relationship.muted).toBe(false); // followed1 is blocked
      expect(result.items[1].relationship.muted).toBe(false); // followed2 is not blocked
    });

    it('should correctly set isFollowing flag based on follow backs', async () => {
      // Arrange
      const mockFollowings = [
        {
          followerId: requestedUserId,
          followedId: BigInt(2),
          followedUser: {
            id: BigInt(2),
            username: 'followed1',
            profile: { displayName: 'Followed One' },
          },
        },
        {
          followerId: requestedUserId,
          followedId: BigInt(3),
          followedUser: {
            id: BigInt(3),
            username: 'followed2',
            profile: { displayName: 'Followed Two' },
          },
        },
      ];

      mockRepository.getUserFollowings.mockResolvedValue(mockFollowings);

      mockRepository.getUsersRelationshipsMap.mockResolvedValue(
        new Map<bigint, UserRelationshipDto>([
          [
            BigInt(2),
            { following: false, follower: true, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(3),
            { following: true, follower: false, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(4),
            {
              following: false,
              follower: false,
              blockedBy: false,
              blocking: false,
              muted: false,
            },
          ],
        ]),
      );
      // Act
      const result = await service.getUserFollowings(mockUsername, authUserId, limit);
      // Assert
      expect(result.items[0].relationship.following).toBe(false);
      expect(result.items[0].relationship.follower).toBe(true);
      expect(result.items[1].relationship.following).toBe(true);
      expect(result.items[1].relationship.follower).toBe(false);
    });

    it('should throw NOT_FOUND if requested user does not exist', async () => {
      // Arrange
      mockRepository.findByUsername.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getUserFollowings(mockUsername, authUserId, limit)).rejects.toThrow(
        HttpException,
      );

      await expect(
        service.getUserFollowings(mockUsername, authUserId, limit),
      ).rejects.toMatchObject({
        response: {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('should return empty items when user has no followings', async () => {
      // Arrange
      mockRepository.getUserFollowings.mockResolvedValue([]);

      mockRepository.getUsersRelationshipsMap.mockResolvedValue(
        new Map<bigint, UserRelationshipDto>([
          [
            BigInt(2),
            { following: false, follower: true, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(3),
            { following: true, follower: false, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(4),
            {
              following: false,
              follower: false,
              blockedBy: false,
              blocking: false,
              muted: false,
            },
          ],
        ]),
      );

      // Act
      const result = await service.getUserFollowings(mockUsername, authUserId, limit);

      // Assert
      expect(result.items).toEqual([]);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.nextCursor).toBeNull();
    });
  });
  describe('getUserMutualFollowers', () => {
    const mockUsername = 'testuser';
    const authUserId = BigInt(100);
    const requestedUserId = BigInt(1);
    const limit = 2;

    // Helper to encode a valid cursor
    const encodeValidCursor = (followerId: string, followedId: string): string => {
      const cursorObj = { followerId, followedId };
      return Buffer.from(JSON.stringify(cursorObj)).toString('base64');
    };

    beforeEach(() => {
      // Mock the requested user lookup
      mockRepository.findByUsername.mockResolvedValue({
        id: requestedUserId,
        username: mockUsername,
      });
    });

    it('should return mutualFollowers without cursor (first page)', async () => {
      // Arrange: 3 mutual followers returned (limit+1 to detect hasNextPage)
      const mockAuthFollowings = [
        {
          followerId: authUserId,
          followedId: BigInt(2),
          followedUser: {
            id: BigInt(2),
            username: 'followed1',
            profile: { displayName: 'Followed One', bio: 'Bio 1' },
          },
        },
        {
          followerId: authUserId,
          followedId: BigInt(3),
          followedUser: {
            id: BigInt(3),
            username: 'followed2',
            profile: { displayName: 'Followed Two', bio: 'Bio 2' },
          },
        },
        {
          followerId: authUserId,
          followedId: BigInt(4),
          followedUser: {
            id: BigInt(4),
            username: 'followed3',
            profile: { displayName: 'Followed Three', bio: 'Bio 3' },
          },
        },
        {
          followerId: authUserId,
          followedId: BigInt(5),
          followedUser: {
            id: BigInt(5),
            username: 'followed4',
            profile: { displayName: 'Followed Four', bio: 'Bio 4' },
          },
        },
      ];
      const mockMutualFollowers = [
        {
          followedId: requestedUserId,
          followerId: BigInt(2),
          followerUser: {
            id: BigInt(2),
            username: 'followed1',
            profile: { displayName: 'Followed One', bio: 'Bio 1' },
          },
        },
        {
          followedId: requestedUserId,
          followerId: BigInt(3),
          followerUser: {
            id: BigInt(3),
            username: 'followed2',
            profile: { displayName: 'Followed Two', bio: 'Bio 2' },
          },
        },
        {
          followedId: requestedUserId,
          followerId: BigInt(4),
          followerUser: {
            id: BigInt(4),
            username: 'followed3',
            profile: { displayName: 'Followed Three', bio: 'Bio 3' },
          },
        },
      ];

      mockRepository.getUserIdsFollowedBy.mockResolvedValue(mockAuthFollowings);
      mockRepository.getUserMutualFollowers.mockResolvedValue(mockMutualFollowers);

      mockRepository.getUsersRelationshipsMap.mockResolvedValue(
        new Map<bigint, UserRelationshipDto>([
          [
            BigInt(2),
            { following: false, follower: true, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(3),
            { following: true, follower: false, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(4),
            {
              following: false,
              follower: false,
              blockedBy: false,
              blocking: false,
              muted: false,
            },
          ],
        ]),
      );

      // Act
      const result = await service.getUserMutualFollowers(mockUsername, authUserId, limit);

      // Assert
      expect(mockRepository.findByUsername).toHaveBeenCalledWith(mockUsername);
      expect(mockRepository.getUserIdsFollowedBy).toHaveBeenCalledWith(authUserId);
      expect(mockRepository.getUserMutualFollowers).toHaveBeenCalledWith(
        requestedUserId,
        mockAuthFollowings,
        limit + 1,
        undefined, // no cursor decoded
      );
      // Note: paginateComposite removes the extra item, so only first 2 follower IDs are passed
      expect(mockRepository.getUsersRelationshipsMap).toHaveBeenCalledWith(authUserId, [
        BigInt(2),
        BigInt(3),
      ]);

      // Only first 2 items returned (limit=2), third is used for pagination
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({
        displayName: 'Followed One',
        username: 'followed1',
        relationship: {
          following: false,
          follower: true,
          blockedBy: false,
          blocking: false,
          muted: false,
        },
      });
      expect(result.items[1]).toMatchObject({
        displayName: 'Followed Two',
        username: 'followed2',
        relationship: {
          following: true,
          follower: false,
          blockedBy: false,
          blocking: false,
          muted: false,
        },
      });

      // Pagination should indicate next page
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.nextCursor).toBeTruthy();
    });

    it('should return mutualFollowers with valid cursor (subsequent page)', async () => {
      // Arrange
      const validCursor = encodeValidCursor('2', '1'); // followerId=2, followedId=1

      const mockAuthFollowings = [
        {
          followerId: authUserId,
          followedId: BigInt(5),
          followedUser: {
            id: BigInt(5),
            username: 'followed5',
            profile: { displayName: 'Followed Five', bio: 'Bio 5' },
          },
        },
        {
          followerId: authUserId,
          followedId: BigInt(6),
          followedUser: {
            id: BigInt(6),
            username: 'followed6',
            profile: { displayName: 'Followed Six', bio: 'Bio 6' },
          },
        },
        {
          followerId: authUserId,
          followedId: BigInt(7),
          followedUser: {
            id: BigInt(7),
            username: 'followed7',
            profile: { displayName: 'Followed Seven', bio: 'Bio 7' },
          },
        },
      ];
      const mockMutualFollowers = [
        {
          followedId: requestedUserId,
          followerId: BigInt(5),
          followerUser: {
            id: BigInt(5),
            username: 'followed5',
            profile: { displayName: 'Followed Five', bio: 'Bio 5' },
          },
        },
        {
          followedId: requestedUserId,
          followerId: BigInt(6),
          followerUser: {
            id: BigInt(6),
            username: 'followed6',
            profile: { displayName: 'Followed Six', bio: 'Bio 6' },
          },
        },
      ];

      mockRepository.getUsersRelationshipsMap.mockResolvedValue(
        new Map<bigint, UserRelationshipDto>([
          [
            BigInt(2),
            { following: false, follower: true, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(3),
            { following: true, follower: false, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(4),
            {
              following: false,
              follower: false,
              blockedBy: false,
              blocking: false,
              muted: false,
            },
          ],
        ]),
      );
      mockRepository.getUserIdsFollowedBy.mockResolvedValue(mockAuthFollowings);
      mockRepository.getUserMutualFollowers.mockResolvedValue(mockMutualFollowers);
      // Act
      const result = await service.getUserMutualFollowers(
        mockUsername,
        authUserId,
        limit,
        validCursor,
      );

      // Assert
      expect(mockRepository.getUserMutualFollowers).toHaveBeenCalledWith(
        requestedUserId,
        mockAuthFollowings,
        limit + 1,
        { followerId: '2', followedId: '1' }, // decoded cursor
      );

      expect(result.items).toHaveLength(2);
      expect(result.pagination.cursor).toBe(validCursor); // prevCursor echoed back
      expect(result.pagination.hasNextPage).toBe(false); // only 2 items, no extra
    });

    it('should throw BadRequest for invalid cursor format', async () => {
      // Arrange: a cursor that is not valid base64 JSON
      const invalidCursor = 'not-valid-base64!!!';

      // Act & Assert
      await expect(
        service.getUserMutualFollowers(mockUsername, authUserId, limit, invalidCursor),
      ).rejects.toThrow(HttpException);

      await expect(
        service.getUserMutualFollowers(mockUsername, authUserId, limit, invalidCursor),
      ).rejects.toMatchObject({
        response: {
          message: 'Invalid cursor format',
          code: 'INVALID_FORMAT',
        },
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('should flag blocked and muted users as blocked in the response', async () => {
      // Arrange
      const mockMutualFollowers = [
        {
          followedId: requestedUserId,
          followerId: BigInt(2),
          followerUser: {
            id: BigInt(2),
            username: 'followed1',
            profile: { displayName: 'Followed One' },
          },
        },
        {
          followedId: requestedUserId,
          followerId: BigInt(3),
          followerUser: {
            id: BigInt(3),
            username: 'followed2',
            profile: { displayName: 'Followed Two' },
          },
        },
      ];

      mockRepository.getUserMutualFollowers.mockResolvedValue(mockMutualFollowers);
      mockRepository.getUsersRelationshipsMap.mockResolvedValue(
        new Map<bigint, UserRelationshipDto>([
          [
            BigInt(2),
            { following: false, follower: true, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(3),
            { following: true, follower: false, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(4),
            {
              following: false,
              follower: false,
              blockedBy: false,
              blocking: false,
              muted: false,
            },
          ],
        ]),
      );
      // Act
      const result = await service.getUserMutualFollowers(mockUsername, authUserId, limit);

      // Assert
      expect(result.items[0].relationship.blocking).toBe(false); // followed1 is blocked
      expect(result.items[1].relationship.blocking).toBe(false); // followed2 is not blocked
      expect(result.items[0].relationship.muted).toBe(false); // followed1 is muted
      expect(result.items[1].relationship.muted).toBe(false); // followed2 is not blocked
    });

    it('should correctly set isFollowing flag based on follow backs', async () => {
      // Arrange
      const mockMutualFollowers = [
        {
          followedId: requestedUserId,
          followerId: BigInt(2),
          followerUser: {
            id: BigInt(2),
            username: 'followed1',
            profile: { displayName: 'Followed One' },
          },
        },
        {
          followedId: requestedUserId,
          followerId: BigInt(3),
          followerUser: {
            id: BigInt(3),
            username: 'followed2',
            profile: { displayName: 'Followed Two' },
          },
        },
      ];

      mockRepository.getUserMutualFollowers.mockResolvedValue(mockMutualFollowers);
      mockRepository.getUsersRelationshipsMap.mockResolvedValue(
        new Map<bigint, UserRelationshipDto>([
          [
            BigInt(2),
            { following: false, follower: true, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(3),
            { following: true, follower: false, blockedBy: false, blocking: false, muted: false },
          ],
          [
            BigInt(4),
            {
              following: false,
              follower: false,
              blockedBy: false,
              blocking: false,
              muted: false,
            },
          ],
        ]),
      );
      // Act
      const result = await service.getUserMutualFollowers(mockUsername, authUserId, limit);
      // Assert
      expect(result.items[0].relationship.following).toBe(false);
      expect(result.items[0].relationship.follower).toBe(true);
      expect(result.items[1].relationship.following).toBe(true);
      expect(result.items[1].relationship.follower).toBe(false);
    });

    it('should throw NOT_FOUND if requested user does not exist', async () => {
      // Arrange
      mockRepository.findByUsername.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getUserMutualFollowers(mockUsername, authUserId, limit)).rejects.toThrow(
        HttpException,
      );

      await expect(
        service.getUserMutualFollowers(mockUsername, authUserId, limit),
      ).rejects.toMatchObject({
        response: {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_CODES.USER_NOT_FOUND,
        },
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('should return empty items when user has no mutualFollowers', async () => {
      // Arrange
      mockRepository.getUserMutualFollowers.mockResolvedValue([]);
      mockRepository.getUsersRelationshipsMap.mockResolvedValue([]);
      // Act
      const result = await service.getUserMutualFollowers(mockUsername, authUserId, limit);
      // Assert
      expect(result.items).toEqual([]);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.nextCursor).toBeNull();
    });
  });
});
