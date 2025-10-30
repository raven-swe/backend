import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { NewUser } from './interfaces/NewUser.interface';
import { HttpException, HttpStatus } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { LanguageCode } from '@prisma/client';
import { ChangePasswordBasicDto } from './dtos/change-password-basic.dto';
import { OtpType } from 'src/email/interfaces/email.interfaces';

jest.mock('src/auth/utils/password.util');
jest.mock('./utils/validate-password-format.util');

import { comparePassword, hashPassword } from 'src/auth/utils/password.util';
import { USERS_ERROR_CODES, USERS_ERROR_MESSAGES } from 'src/common/constants/users.constants';
import { UpdateProfileDto } from './dtos/update-profile.dto';

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
    mutualNames: ['Omar', 'Tasneem'],
  };

  const mockRepository = {
    findByEmail: jest.fn(),
    findByUsername: jest.fn(),
    findByIdentifier: jest.fn(),
    findById: jest.fn(),
    createUser: jest.fn(),
    updatePasswordById: jest.fn(),
    updateProfile: jest.fn(),
    findUserProfileByUsername: jest.fn(),
    updateUsernameById: jest.fn(),
    updateUserEmail: jest.fn(),
  };

  const mockEmailQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: mockRepository },
        { provide: PrismaService, useValue: {} },
        { provide: UsersService, useClass: UsersService },
        { provide: getQueueToken('email'), useValue: mockEmailQueue },
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
          HttpStatus.UNAUTHORIZED,
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
          HttpStatus.UNAUTHORIZED,
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
      avatarUrl: 'https://example.com/new-avatar.jpg',
      bannerUrl: 'https://example.com/new-banner.jpg',
    };

    test('should successfully update user profile with all fields provided', async () => {
      const updatedProfile = {
        ...updateProfileDto,
        updatedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(mockUser);
      mockRepository.updateProfile.mockResolvedValue(updatedProfile);

      const result = await service.updateProfile(BigInt(1), updateProfileDto);

      expect(result).toEqual(updatedProfile);
      expect(mockRepository.findById).toHaveBeenCalledWith(BigInt(1));
      expect(mockRepository.updateProfile).toHaveBeenCalledWith(BigInt(1), updateProfileDto);
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

      mockRepository.findById.mockResolvedValue(mockUser);
      mockRepository.updateProfile.mockResolvedValue(updatedProfile);

      const result = await service.updateProfile(BigInt(1), partialUpdateDto);
      expect(result).toEqual(updatedProfile);
      expect(mockRepository.findById).toHaveBeenCalledWith(BigInt(1));
      expect(mockRepository.updateProfile).toHaveBeenCalledWith(BigInt(1), partialUpdateDto);
    });

    test('should throw error if user not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.updateProfile(BigInt(1), updateProfileDto)).rejects.toThrow(
        new HttpException(
          {
            message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
            code: USERS_ERROR_CODES.USER_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );

      expect(mockRepository.findById).toHaveBeenCalledWith(BigInt(1));
      expect(mockRepository.updateProfile).not.toHaveBeenCalled();
    });

    it('should handle empty update data', async () => {
      const emptyUpdateDto: UpdateProfileDto = {};
      mockRepository.findById.mockResolvedValue(mockUser);
      mockRepository.updateProfile.mockResolvedValue(mockUserProfile);

      const result = await service.updateProfile(BigInt(1), emptyUpdateDto);

      // No data to update, should return existing profile
      expect(result).toEqual(mockUserProfile);
      expect(mockRepository.updateProfile).toHaveBeenCalledWith(BigInt(1), emptyUpdateDto);
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
        mutualNames: ['Omar', 'Tasneem'],
      };

      mockRepository.findUserProfileByUsername.mockResolvedValue(profileWithMutuals);

      const result = await service.getUserProfile('testuser', BigInt(2));

      expect(result.mutualsCount).toBe(2);
      expect(result.mutualNames).toEqual(['Omar', 'Tasneem']);
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
});
