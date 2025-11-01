import { Test, TestingModule } from '@nestjs/testing';
import { MeController } from './me.controller';
import { UsersService } from '../users.service';
import { ChangePasswordBasicDto } from '../dtos/change-password-basic.dto';
import { RequestUser } from 'src/auth/types';

describe('MeController', () => {
  let controller: MeController;

  const mockUsersService = {
    changePassword: jest.fn(),
    getUserProfile: jest.fn(),
    updateProfile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<MeController>(MeController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('PUT /me/password', () => {
    const changePasswordDto: ChangePasswordBasicDto = {
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword456',
    };

    it('should call usersService.changePassword with correct parameters', async () => {
      // Arrange
      const expectedUserId = BigInt(1);
      const expectedResult = { message: 'Password changed successfully' };

      mockUsersService.changePassword.mockResolvedValue(expectedResult);

      // Act
      const user: RequestUser = { id: expectedUserId.toString() };
      const result = await controller.changePassword(changePasswordDto, user);

      // Assert
      expect(mockUsersService.changePassword).toHaveBeenCalledWith(
        expectedUserId,
        changePasswordDto,
      );
      expect(mockUsersService.changePassword).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should return the result from usersService.changePassword', async () => {
      const mockResponse = {
        success: true,
        message: 'Password updated successfully',
      };

      mockUsersService.changePassword.mockResolvedValue(mockResponse);

      const user: RequestUser = { id: '18' };
      const result = await controller.changePassword(changePasswordDto, user);

      expect(result).toEqual(mockResponse);
    });

    it('should handle errors thrown by usersService.changePassword', async () => {
      const error = new Error('Invalid old password');

      mockUsersService.changePassword.mockRejectedValue(error);

      const user: RequestUser = { id: '18' };
      await expect(controller.changePassword(changePasswordDto, user)).rejects.toThrow(
        'Invalid old password',
      );
      expect(mockUsersService.changePassword).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /me', () => {
    it('should call usersService.getUserProfile with correct parameters', async () => {
      // Arrange
      const expectedResult = {
        displayName: 'Omar Hassan',
        bio: 'Software Developer',
      };

      mockUsersService.getUserProfile.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.getMyProfile({
        id: '18',
      });

      // Assert
      expect(mockUsersService.getUserProfile).toHaveBeenCalledWith('', BigInt(18), true);
      expect(mockUsersService.getUserProfile).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('PATCH /me', () => {
    const updateProfileDto = {
      displayName: 'Omar Hassan',
      bio: 'Software Developer',
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

    it('should call usersService.updateProfile with correct parameters', async () => {
      // Arrange
      const expectedUserId = BigInt(18);
      const expectedResult = { message: 'Profile updated successfully' };

      mockUsersService.updateProfile.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.updateProfile({ id: '18' }, {}, updateProfileDto);

      // Assert
      expect(mockUsersService.updateProfile).toHaveBeenCalledWith(
        expectedUserId,
        updateProfileDto,
        {},
      );
      expect(mockUsersService.updateProfile).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should call usersService.updateProfile with avatar file', async () => {
      // Arrange
      const expectedUserId = BigInt(18);
      const expectedResult = {
        message: 'Profile updated successfully',
        avatarUrl: 'https://example.com/avatar.jpg',
      };

      mockUsersService.updateProfile.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.updateProfile(
        { id: '18' },
        { avatar: mockFiles.avatar },
        updateProfileDto,
      );

      // Assert
      expect(mockUsersService.updateProfile).toHaveBeenCalledWith(
        expectedUserId,
        updateProfileDto,
        { avatar: mockFiles.avatar },
      );
      expect(mockUsersService.updateProfile).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should call usersService.updateProfile with both avatar and banner files', async () => {
      // Arrange
      const expectedUserId = BigInt(18);
      const expectedResult = {
        message: 'Profile updated successfully',
        avatarUrl: 'https://example.com/avatar.jpg',
        bannerUrl: 'https://example.com/banner.jpg',
      };

      mockUsersService.updateProfile.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.updateProfile({ id: '18' }, mockFiles, updateProfileDto);

      // Assert
      expect(mockUsersService.updateProfile).toHaveBeenCalledWith(
        expectedUserId,
        updateProfileDto,
        mockFiles,
      );
      expect(mockUsersService.updateProfile).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle profile update without any files', async () => {
      // Arrange
      const expectedUserId = BigInt(18);
      const expectedResult = {
        message: 'Profile updated successfully',
        displayName: 'Omar Hassan',
        bio: 'Software Developer',
      };

      mockUsersService.updateProfile.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.updateProfile({ id: '18' }, {}, updateProfileDto);

      // Assert
      expect(mockUsersService.updateProfile).toHaveBeenCalledWith(
        expectedUserId,
        updateProfileDto,
        {},
      );
      expect(result).toEqual(expectedResult);
    });

    it('should handle errors thrown by usersService.updateProfile', async () => {
      // Arrange
      const error = new Error('Failed to update profile');

      mockUsersService.updateProfile.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.updateProfile({ id: '18' }, { avatar: mockFiles.avatar }, updateProfileDto),
      ).rejects.toThrow('Failed to update profile');
      expect(mockUsersService.updateProfile).toHaveBeenCalledTimes(1);
    });
  });
});
