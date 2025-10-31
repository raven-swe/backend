import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService = {
    followUser: jest.fn(),
    unfollowUser: jest.fn(),
    blockUser: jest.fn(),
    unblockUser: jest.fn(),
    muteUser: jest.fn(),
    unmuteUser: jest.fn(),
  };

  const mockUsersRepository = {
    findByUsername: jest.fn(),
    followUser: jest.fn(),
    unfollowUser: jest.fn(),
    isFollowing: jest.fn(),
    blockUser: jest.fn(),
    unblockUser: jest.fn(),
    muteUser: jest.fn(),
    unmuteUser: jest.fn(),
    isMuted: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: UsersRepository, useValue: mockUsersRepository },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /:username/following', () => {
    it('should call usersService.followUser with correct parameters', async () => {
      // Arrange
      const followerId = BigInt(1);
      const followedUsername = 'testuser';
      const expectedResult = { message: 'Followed user successfully' };

      mockUsersService.followUser.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.followUser(followedUsername, { id: followerId.toString() });

      // Assert
      expect(mockUsersService.followUser).toHaveBeenCalledWith(followerId, followedUsername);
      expect(mockUsersService.followUser).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle errors thrown by usersService.followUser', async () => {
      // Arrange
      const followerId = BigInt(1);
      const followedUsername = 'nonexistentuser';

      mockUsersService.followUser.mockRejectedValue(new Error('User not found'));

      // Act & Assert
      await expect(
        controller.followUser(followedUsername, { id: followerId.toString() }),
      ).rejects.toThrow('User not found');
      expect(mockUsersService.followUser).toHaveBeenCalledWith(followerId, followedUsername);
      expect(mockUsersService.followUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /:username/following', () => {
    it('should call usersService.unfollowUser with correct parameters', async () => {
      // Arrange
      const followerId = BigInt(1);
      const unfollowedUsername = 'testuser';
      const expectedResult = { message: 'Unfollowed user successfully' };

      mockUsersService.unfollowUser.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.unfollowUser(unfollowedUsername, { id: followerId.toString() });

      // Assert
      expect(mockUsersService.unfollowUser).toHaveBeenCalledWith(followerId, unfollowedUsername);
      expect(mockUsersService.unfollowUser).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle errors thrown by usersService.unfollowUser', async () => {
      // Arrange
      const followerId = BigInt(1);
      const unfollowedUsername = 'nonexistentuser';

      mockUsersService.unfollowUser.mockRejectedValue(new Error('User not found'));

      // Act & Assert
      await expect(
        controller.unfollowUser(unfollowedUsername, { id: followerId.toString() }),
      ).rejects.toThrow('User not found');
      expect(mockUsersService.unfollowUser).toHaveBeenCalledWith(followerId, unfollowedUsername);
      expect(mockUsersService.unfollowUser).toHaveBeenCalledTimes(1);
    });
  });
});
