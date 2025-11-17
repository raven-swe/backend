import { Test, TestingModule } from '@nestjs/testing';
import { MeController } from 'src/users/me/me.controller';
import { UsersService } from 'src/users/users.service';
import { ChangePasswordBasicDto } from 'src/users/dtos';
import type { RequestUser } from 'src/common/interfaces';

describe('MeController', () => {
  let controller: MeController;

  const mockUsersService = {
    changePassword: jest.fn(),
    blockUser: jest.fn(),
    unblockUser: jest.fn(),
    muteUser: jest.fn(),
    unmuteUser: jest.fn(),
    getUserProfile: jest.fn(),
    updateProfile: jest.fn(),
    uploadBanner: jest.fn(),
    uploadAvatar: jest.fn(),
    deleteBanner: jest.fn(),
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

  describe('POST /me/blocks/:username', () => {
    it('should call usersService.blockUser with correct parameters', async () => {
      // Arrange
      const userId = BigInt(1);
      const blockedUsername = 'blockedUser';
      const expectedResult = { message: 'User blocked successfully' };

      mockUsersService.blockUser.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.blockUser({ id: userId.toString() }, blockedUsername);

      // Assert
      expect(mockUsersService.blockUser).toHaveBeenCalledWith(userId, blockedUsername);
      expect(mockUsersService.blockUser).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle errors thrown by usersService.blockUser', async () => {
      // Arrange
      const userId = BigInt(1);
      const blockedUsername = 'nonexistentUser';

      mockUsersService.blockUser.mockRejectedValue(new Error('User not found'));

      // Act & Assert
      await expect(
        controller.blockUser({ id: userId.toString() }, blockedUsername),
      ).rejects.toThrow('User not found');
      expect(mockUsersService.blockUser).toHaveBeenCalledWith(userId, blockedUsername);
      expect(mockUsersService.blockUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /me/blocks/:username', () => {
    it('should call usersService.unblockUser with correct parameters', async () => {
      // Arrange
      const userId = BigInt(1);
      const unblockedUsername = 'blockedUser';
      const expectedResult = { message: 'User unblocked successfully' };

      mockUsersService.unblockUser.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.unblockUser({ id: userId.toString() }, unblockedUsername);

      // Assert
      expect(mockUsersService.unblockUser).toHaveBeenCalledWith(userId, unblockedUsername);
      expect(mockUsersService.unblockUser).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle errors thrown by usersService.unblockUser', async () => {
      // Arrange
      const userId = BigInt(1);
      const unblockedUsername = 'nonexistentUser';

      mockUsersService.unblockUser.mockRejectedValue(new Error('User not found'));

      // Act & Assert
      await expect(
        controller.unblockUser({ id: userId.toString() }, unblockedUsername),
      ).rejects.toThrow('User not found');
      expect(mockUsersService.unblockUser).toHaveBeenCalledWith(userId, unblockedUsername);
      expect(mockUsersService.unblockUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /me/mutes/:username', () => {
    it('should call usersService.muteUser with correct parameters', async () => {
      // Arrange
      const userId = BigInt(1);
      const mutedUsername = 'mutedUser';
      const expectedResult = { message: 'User muted successfully' };

      mockUsersService.muteUser.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.muteUser({ id: userId.toString() }, mutedUsername);

      // Assert
      expect(mockUsersService.muteUser).toHaveBeenCalledWith(userId, mutedUsername);
      expect(mockUsersService.muteUser).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle errors thrown by usersService.muteUser', async () => {
      // Arrange
      const userId = BigInt(1);
      const mutedUsername = 'nonexistentUser';

      mockUsersService.muteUser.mockRejectedValue(new Error('User not found'));

      // Act & Assert
      await expect(controller.muteUser({ id: userId.toString() }, mutedUsername)).rejects.toThrow(
        'User not found',
      );
      expect(mockUsersService.muteUser).toHaveBeenCalledWith(userId, mutedUsername);
      expect(mockUsersService.muteUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /me/mutes/:username', () => {
    it('should call usersService.unmuteUser with correct parameters', async () => {
      // Arrange
      const userId = BigInt(1);
      const unmutedUsername = 'mutedUser';
      const expectedResult = { message: 'User unmuted successfully' };

      mockUsersService.unmuteUser.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.unmuteUser({ id: userId.toString() }, unmutedUsername);

      // Assert
      expect(mockUsersService.unmuteUser).toHaveBeenCalledWith(userId, unmutedUsername);
      expect(mockUsersService.unmuteUser).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle errors thrown by usersService.unmuteUser', async () => {
      // Arrange
      const userId = BigInt(1);
      const unmutedUsername = 'nonexistentUser';

      mockUsersService.unmuteUser.mockRejectedValue(new Error('User not found'));

      // Act & Assert
      await expect(
        controller.unmuteUser({ id: userId.toString() }, unmutedUsername),
      ).rejects.toThrow('User not found');
      expect(mockUsersService.unmuteUser).toHaveBeenCalledWith(userId, unmutedUsername);
      expect(mockUsersService.unmuteUser).toHaveBeenCalledTimes(1);
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

    it('should call usersService.updateProfile with correct parameters', async () => {
      // Arrange
      const expectedUserId = BigInt(18);
      const expectedResult = { message: 'Profile updated successfully' };

      mockUsersService.updateProfile.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.updateProfile(updateProfileDto, {
        id: '18',
      });

      // Assert
      expect(mockUsersService.updateProfile).toHaveBeenCalledWith(expectedUserId, updateProfileDto);
      expect(mockUsersService.updateProfile).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('POST /me/profile-picture', () => {
    const avatar = {
      fieldname: 'avatar',
      originalname: 'avatar.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('fake-avatar-data'),
      size: 1024,
    } as Express.Multer.File;

    it('should call usersService.uploadAvatar with correct parameters', async () => {
      // Arrange
      const expectedUserId = BigInt(18);
      const expectedResult = { message: 'Avatar uploaded successfully' };

      mockUsersService.uploadAvatar.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.uploadAvatar({ id: '18' }, avatar);

      // Assert
      expect(mockUsersService.uploadAvatar).toHaveBeenCalledWith(expectedUserId, avatar);
      expect(mockUsersService.uploadAvatar).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('POST /me/banner', () => {
    const banner = {
      fieldname: 'banner',
      originalname: 'banner.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('fake-banner-data'),
      size: 2048,
    } as Express.Multer.File;

    it('should call usersService.uploadBanner with correct parameters', async () => {
      // Arrange
      const expectedUserId = BigInt(18);
      const expectedResult = { message: 'Banner uploaded successfully' };

      mockUsersService.uploadBanner.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.uploadBanner({ id: '18' }, banner);

      // Assert
      expect(mockUsersService.uploadBanner).toHaveBeenCalledWith(expectedUserId, banner);
      expect(mockUsersService.uploadBanner).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('DELETE /me/banner', () => {
    it('should call usersService.deleteBanner with correct parameters', async () => {
      // Arrange
      const expectedUserId = BigInt(18);
      const expectedResult = { message: 'Banner deleted successfully' };

      mockUsersService.deleteBanner.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.deleteBanner({ id: '18' });

      // Assert
      expect(mockUsersService.deleteBanner).toHaveBeenCalledWith(expectedUserId);
      expect(mockUsersService.deleteBanner).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });
  });
});
