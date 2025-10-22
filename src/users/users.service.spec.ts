import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { NewUser } from './interfaces/NewUser.interface';
import { HttpException, HttpStatus } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { LanguageCode } from '@prisma/client';
import { validate } from 'class-validator';
import { ChangePasswordBasicDto } from './dtos/change-password-basic.dto';
import { OtpType } from 'src/email/interfaces/email.interfaces';

jest.mock('src/auth/utils/password.util');

import { comparePassword, hashPassword } from 'src/auth/utils/password.util';
import { USERS_ERROR_CODES, USERS_ERROR_MESSAGES } from 'src/common/constants/users.constants';

// Cast to jest mocks for TypeScript
const mockComparePassword = comparePassword as jest.MockedFunction<typeof comparePassword>;
const mockHashPassword = hashPassword as jest.MockedFunction<typeof hashPassword>;

describe('UsersService', () => {
  let service: UsersService;
  let mockUsersRepository: Partial<UsersRepository>;

  const mockUser = {
    id: BigInt(1),
    email: 'test@example.com',
    username: 'testuser',
    password_hash: 'hashedPassword123',
    birth_date: new Date('2000-01-01'),
    language_code: LanguageCode.EN,
  };

  const mockRepository = {
    findByEmail: jest.fn(),
    findByUsername: jest.fn(),
    findByIdentifier: jest.fn(),
    findById: jest.fn(),
    createUser: jest.fn(),
    updatePasswordById: jest.fn(),
  };

  const mockEmailQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    mockUsersRepository = {
      findByEmail: jest.fn(),
      createUser: jest.fn(),
      findByIdentifier: jest.fn(),
      findByUsername: jest.fn(),
      updatePasswordById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: mockUsersRepository },
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
      (mockUsersRepository.findByUsername as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findByUsername(username);

      expect(mockUsersRepository.findByUsername).toHaveBeenCalledWith(username);
      expect(result).toBe(mockUser);
    });
  });

  describe('findByIdentifier', () => {
    const mockUser = { id: BigInt(1), email: 'test@gmail.com', username: 'testuser' };

    it('should call the repository with the correct identifier and return its result', async () => {
      const identifier = 'testuser';
      (mockUsersRepository.findByIdentifier as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findByIdentifier(identifier);

      expect(mockUsersRepository.findByIdentifier).toHaveBeenCalledWith(identifier);
      expect(result).toBe(mockUser);
    });
  });

  describe('updatePasswordById', () => {
    it('should call the repository with the correct userId and new password hash', async () => {
      const userId = BigInt(1);
      const newHashedPassword = 'newHashedPassword123';
      const expectedUpdatedUser = { id: userId, password_hash: newHashedPassword };

      (mockUsersRepository.updatePasswordById as jest.Mock).mockResolvedValue(expectedUpdatedUser);

      const result = await service.updatePasswordById(userId, newHashedPassword);

      expect(mockUsersRepository.updatePasswordById).toHaveBeenCalledWith(
        userId,
        newHashedPassword,
      );
      expect(result).toEqual(expectedUpdatedUser);
    });
  });

  describe('findByEmail', () => {
    it('should call the repository with the correct email and return its result', async () => {
      const email = 'test@gmail.com';
      const expectedUser = { id: BigInt(1), email, password_hash: '...' };
      (mockUsersRepository.findByEmail as jest.Mock).mockResolvedValue(expectedUser);

      const result = await service.findByEmail(email);

      expect(mockUsersRepository.findByEmail).toHaveBeenCalledWith(email);
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
      (mockUsersRepository.createUser as jest.Mock).mockResolvedValue(expectedCreatedUser);

      const result = await service.createUser(newUserDto, {} as never);

      expect(mockUsersRepository.createUser).toHaveBeenCalledWith(newUserDto, {} as never);
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

    beforeEach(() => {
      (validate as jest.Mock) = jest.fn().mockResolvedValue([]);
    });

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
      expect(comparePassword).toHaveBeenNthCalledWith(1, 'OldPassword123!', mockUser.password_hash);
      expect(comparePassword).toHaveBeenNthCalledWith(2, 'NewPassword123!', mockUser.password_hash);

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
            message: USERS_ERROR_MESSAGES.PASSWORD_NOT_SET,
            code: USERS_ERROR_CODES.PASSWORD_NOT_SET,
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

    it('should throw error if new password format is invalid', async () => {
      mockRepository.findById.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(true);
      (validate as jest.Mock).mockResolvedValue([
        {
          property: 'newPassword',
          constraints: { minLength: 'Password must be at least 10 characters' },
        },
      ]);

      await expect(service.changePassword(BigInt(1), changePasswordDto)).rejects.toThrow(
        HttpException,
      );
      expect(validate).toHaveBeenCalled();
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

    it('should throw an error if current password is empty', async () => {
      const invalidDto = {
        currentPassword: '',
        newPassword: 'NewPassword123!',
      } as ChangePasswordBasicDto;

      await expect(service.changePassword(BigInt(1), invalidDto)).rejects.toThrow(HttpException);
      expect(validate).toHaveBeenCalled();
    });
  });
});
