import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from 'src/users/users.controller';
import { UsersRepository } from 'src/users/users.repository';
import { UsersService } from 'src/users/users.service';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService: jest.Mocked<Partial<UsersService>> = {
    followUser: jest.fn(),
    unfollowUser: jest.fn(),
    blockUser: jest.fn(),
    unblockUser: jest.fn(),
    muteUser: jest.fn(),
    unmuteUser: jest.fn(),
    getUserProfile: jest.fn(),
    getUserFollowers: jest.fn(),
    getUserFollowings: jest.fn(),
    getUserMutualFollowers: jest.fn(),
    getUserRelationship: jest.fn(),
    enableUserNotifications: jest.fn(),
    disableUserNotifications: jest.fn(),
    getUserById: jest.fn(),
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
    getUserProfile: jest.fn(),
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

      (mockUsersService.followUser as jest.Mock).mockResolvedValue(expectedResult);

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

      (mockUsersService.followUser as jest.Mock).mockRejectedValue(new Error('User not found'));

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

      (mockUsersService.unfollowUser as jest.Mock).mockResolvedValue(expectedResult);

      // Act
      const result = await controller.unfollowUser(unfollowedUsername, {
        id: followerId.toString(),
      });

      // Assert
      expect(mockUsersService.unfollowUser).toHaveBeenCalledWith(followerId, unfollowedUsername);
      expect(mockUsersService.unfollowUser).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle errors thrown by usersService.unfollowUser', async () => {
      // Arrange
      const followerId = BigInt(1);
      const unfollowedUsername = 'nonexistentuser';

      (mockUsersService.unfollowUser as jest.Mock).mockRejectedValue(new Error('User not found'));

      // Act & Assert
      await expect(
        controller.unfollowUser(unfollowedUsername, { id: followerId.toString() }),
      ).rejects.toThrow('User not found');
      expect(mockUsersService.unfollowUser).toHaveBeenCalledWith(followerId, unfollowedUsername);
      expect(mockUsersService.unfollowUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /users/:username/profile', () => {
    it('should call usersService.getUserProfile with correct parameters', async () => {
      // Arrange
      const username = 'john_doe';
      const currentUserId = BigInt(1);
      const expectedResult = {
        displayName: 'John Doe',
        bio: 'A sample user',
      };

      (mockUsersService.getUserProfile as jest.Mock).mockResolvedValue(expectedResult);

      // Act
      const result = await controller.getUserProfile(username, {
        id: currentUserId.toString(),
      });

      // Assert
      expect(mockUsersService.getUserProfile).toHaveBeenCalledWith(username, currentUserId);
      expect(mockUsersService.getUserProfile).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should call usersService.getUserProfile with undefined when user is not provided', async () => {
      // Arrange
      const username = 'john_doe';
      const expectedResult = {
        displayName: 'John Doe',
        bio: 'A sample user',
      };

      (mockUsersService.getUserProfile as jest.Mock).mockResolvedValue(expectedResult);

      // Act
      const result = await controller.getUserProfile(username, undefined as any);

      // Assert
      expect(mockUsersService.getUserProfile).toHaveBeenCalledWith(username, undefined);
      expect(mockUsersService.getUserProfile).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });
  });
  describe('GET /users/:username/followers', () => {
    const mockUser = { id: '1' };
    const username = 'testuser';

    it('should return followers with default limit (20) when no limit provided', async () => {
      // Arrange
      const mockServiceResult = {
        items: [
          {
            username: 'follower1',
            displayName: 'Follower One',
            isFollowing: true,
            isBlocked: false,
          },
          {
            username: 'follower2',
            displayName: 'Follower Two',
            isFollowing: false,
            isBlocked: false,
          },
        ],
        pagination: {
          cursor: null,
          nextCursor: 'abc123',
          hasNextPage: true,
        },
      };

      (mockUsersService.getUserFollowers as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserFollowers(username, mockUser, undefined, undefined);

      // Assert
      expect(mockUsersService.getUserFollowers).toHaveBeenCalledWith(
        username,
        BigInt(1),
        20, // default limit
        undefined, // no cursor
      );
      expect(result.items).toHaveLength(2);
      expect(result.pagination).toEqual(mockServiceResult.pagination);
    });

    it('should return followers with custom limit when provided', async () => {
      // Arrange
      const customLimit = '10';
      const mockServiceResult = {
        items: [
          {
            username: 'follower1',
            displayName: 'Follower One',
            isFollowing: true,
            isBlocked: false,
          },
        ],
        pagination: {
          cursor: null,
          nextCursor: null,
          hasNextPage: false,
        },
      };

      (mockUsersService.getUserFollowers as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserFollowers(username, mockUser, customLimit, undefined);

      // Assert
      expect(mockUsersService.getUserFollowers).toHaveBeenCalledWith(
        username,
        BigInt(1),
        10, // custom limit parsed
        undefined,
      );
      expect(result.items).toHaveLength(1);
    });

    it('should return followers with cursor for pagination', async () => {
      // Arrange
      const cursor = 'eyJmb2xsb3dlcklkIjoiMiIsImZvbGxvd2VkSWQiOiIxIn0='; // base64 encoded cursor
      const mockServiceResult = {
        items: [
          {
            username: 'follower3',
            displayName: 'Follower Three',
            isFollowing: false,
            isBlocked: false,
          },
        ],
        pagination: {
          cursor,
          nextCursor: null,
          hasNextPage: false,
        },
      };

      (mockUsersService.getUserFollowers as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserFollowers(username, mockUser, undefined, cursor);

      // Assert
      expect(mockUsersService.getUserFollowers).toHaveBeenCalledWith(
        username,
        BigInt(1),
        20,
        cursor, // cursor passed through
      );
      expect(result.pagination.cursor).toBe(cursor);
    });

    it('should use default limit (20) when invalid limit provided', async () => {
      // Arrange
      const invalidLimits = ['invalid', '-5', '0', 'NaN', ''];
      const mockServiceResult = {
        items: [],
        pagination: { cursor: null, nextCursor: null, hasNextPage: false },
      };

      (mockUsersService.getUserFollowers as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act & Assert
      for (const invalidLimit of invalidLimits) {
        await controller.getUserFollowers(username, mockUser, invalidLimit, undefined);

        expect(mockUsersService.getUserFollowers).toHaveBeenCalledWith(
          username,
          BigInt(1),
          20, // default limit used for invalid values
          undefined,
        );
      }
    });

    it('should transform items to FollowingUserDto instances', async () => {
      // Arrange
      const mockServiceResult = {
        items: [
          {
            username: 'follower1',
            displayName: 'Follower One',
            isFollowing: true,
            isBlocked: false,
          },
          {
            username: 'follower2',
            displayName: 'Follower Two',
            isFollowing: false,
            isBlocked: true,
          },
        ],
        pagination: {
          cursor: null,
          nextCursor: null,
          hasNextPage: false,
        },
      };

      (mockUsersService.getUserFollowers as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserFollowers(username, mockUser, undefined, undefined);

      // Assert
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toHaveProperty('username', 'follower1');
      expect(result.items[0]).toHaveProperty('displayName', 'Follower One');
      expect(result.items[0]).toHaveProperty('isFollowing', true);
      expect(result.items[0]).toHaveProperty('isBlocked', false);
    });

    it('should return empty items array when user has no followers', async () => {
      // Arrange
      const mockServiceResult = {
        items: [],
        pagination: {
          cursor: null,
          nextCursor: null,
          hasNextPage: false,
        },
      };

      (mockUsersService.getUserFollowers as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserFollowers(username, mockUser, undefined, undefined);

      // Assert
      expect(mockUsersService.getUserFollowers).toHaveBeenCalledWith(
        username,
        BigInt(1),
        20,
        undefined,
      );
      expect(result.items).toEqual([]);
      expect(result.pagination.hasNextPage).toBe(false);
    });

    it('should handle large limit values correctly', async () => {
      // Arrange
      const largeLimit = '100';
      const mockServiceResult = {
        items: new Array(100).fill(null).map((_, i) => ({
          username: `follower${i}`,
          displayName: `Follower ${i}`,
          isFollowing: false,
          isBlocked: false,
        })),
        pagination: {
          cursor: null,
          nextCursor: 'nextpage',
          hasNextPage: true,
        },
      };

      (mockUsersService.getUserFollowers as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserFollowers(username, mockUser, largeLimit, undefined);

      // Assert
      expect(mockUsersService.getUserFollowers).toHaveBeenCalledWith(
        username,
        BigInt(1),
        100,
        undefined,
      );
      expect(result.items).toHaveLength(100);
    });

    it('should pass through service errors (user not found)', async () => {
      // Arrange
      const error = new Error('User not found');
      (mockUsersService.getUserFollowers as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.getUserFollowers(username, mockUser, undefined, undefined),
      ).rejects.toThrow('User not found');
    });

    it('should pass through service errors (invalid cursor)', async () => {
      // Arrange
      const invalidCursor = 'invalid!!!';
      const error = new Error('Invalid cursor format');
      (mockUsersService.getUserFollowers as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.getUserFollowers(username, mockUser, undefined, invalidCursor),
      ).rejects.toThrow('Invalid cursor format');
    });

    it('should correctly convert user id string to BigInt', async () => {
      // Arrange
      const largeUserId = '9007199254740991'; // max safe integer
      const mockServiceResult = {
        items: [],
        pagination: { cursor: null, nextCursor: null, hasNextPage: false },
      };

      (mockUsersService.getUserFollowers as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act
      await controller.getUserFollowers(username, { id: largeUserId }, undefined, undefined);

      // Assert
      expect(mockUsersService.getUserFollowers).toHaveBeenCalledWith(
        username,
        BigInt(largeUserId),
        20,
        undefined,
      );
    });
  });
  describe('GET /users/:username/followings', () => {
    const mockUser = { id: '1' };
    const username = 'testuser';

    it('should return followings with default limit (20) when no limit provided', async () => {
      // Arrange
      const mockServiceResult = {
        items: [
          {
            username: 'following1',
            displayName: 'Following One',
            isFollowing: true,
            isBlocked: false,
          },
          {
            username: 'following2',
            displayName: 'Following Two',
            isFollowing: false,
            isBlocked: false,
          },
        ],
        pagination: {
          cursor: null,
          nextCursor: 'abc123',
          hasNextPage: true,
        },
      };

      (mockUsersService.getUserFollowings as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserFollowings(username, mockUser, undefined, undefined);

      // Assert
      expect(mockUsersService.getUserFollowings).toHaveBeenCalledWith(
        username,
        BigInt(1),
        20, // default limit
        undefined, // no cursor
      );
      expect(result.items).toHaveLength(2);
      expect(result.pagination).toEqual(mockServiceResult.pagination);
    });

    it('should return followings with custom limit when provided', async () => {
      // Arrange
      const customLimit = '10';
      const mockServiceResult = {
        items: [
          {
            username: 'following1',
            displayName: 'Following One',
            isFollowing: true,
            isBlocked: false,
          },
        ],
        pagination: {
          cursor: null,
          nextCursor: null,
          hasNextPage: false,
        },
      };

      (mockUsersService.getUserFollowings as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserFollowings(username, mockUser, customLimit, undefined);

      // Assert
      expect(mockUsersService.getUserFollowings).toHaveBeenCalledWith(
        username,
        BigInt(1),
        10, // custom limit parsed
        undefined,
      );
      expect(result.items).toHaveLength(1);
    });

    it('should return followings with cursor for pagination', async () => {
      // Arrange
      const cursor = 'eyJmb2xsb3dlcklkIjoiMiIsImZvbGxvd2VkSWQiOiIxIn0='; // base64 encoded cursor
      const mockServiceResult = {
        items: [
          {
            username: 'following3',
            displayName: 'Following Three',
            isFollowing: false,
            isBlocked: false,
          },
        ],
        pagination: {
          cursor,
          nextCursor: null,
          hasNextPage: false,
        },
      };

      (mockUsersService.getUserFollowings as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserFollowings(username, mockUser, undefined, cursor);

      // Assert
      expect(mockUsersService.getUserFollowings).toHaveBeenCalledWith(
        username,
        BigInt(1),
        20,
        cursor, // cursor passed through
      );
      expect(result.pagination.cursor).toBe(cursor);
    });

    it('should use default limit (20) when invalid limit provided', async () => {
      // Arrange
      const invalidLimits = ['invalid', '-5', '0', 'NaN', ''];
      const mockServiceResult = {
        items: [],
        pagination: { cursor: null, nextCursor: null, hasNextPage: false },
      };

      (mockUsersService.getUserFollowings as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act & Assert
      for (const invalidLimit of invalidLimits) {
        await controller.getUserFollowings(username, mockUser, invalidLimit, undefined);

        expect(mockUsersService.getUserFollowings).toHaveBeenCalledWith(
          username,
          BigInt(1),
          20, // default limit used for invalid values
          undefined,
        );
      }
    });

    it('should transform items to FollowingUserDto instances', async () => {
      // Arrange
      const mockServiceResult = {
        items: [
          {
            username: 'following1',
            displayName: 'Following One',
            isFollowing: true,
            isBlocked: false,
          },
          {
            username: 'following2',
            displayName: 'Following Two',
            isFollowing: false,
            isBlocked: true,
          },
        ],
        pagination: {
          cursor: null,
          nextCursor: null,
          hasNextPage: false,
        },
      };

      (mockUsersService.getUserFollowings as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserFollowings(username, mockUser, undefined, undefined);

      // Assert
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toHaveProperty('username', 'following1');
      expect(result.items[0]).toHaveProperty('displayName', 'Following One');
      expect(result.items[0]).toHaveProperty('isFollowing', true);
      expect(result.items[0]).toHaveProperty('isBlocked', false);
    });

    it('should return empty items array when user has no followings', async () => {
      // Arrange
      const mockServiceResult = {
        items: [],
        pagination: {
          cursor: null,
          nextCursor: null,
          hasNextPage: false,
        },
      };

      (mockUsersService.getUserFollowings as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserFollowings(username, mockUser, undefined, undefined);

      // Assert
      expect(mockUsersService.getUserFollowings).toHaveBeenCalledWith(
        username,
        BigInt(1),
        20,
        undefined,
      );
      expect(result.items).toEqual([]);
      expect(result.pagination.hasNextPage).toBe(false);
    });

    it('should handle large limit values correctly', async () => {
      // Arrange
      const largeLimit = '100';
      const mockServiceResult = {
        items: new Array(100).fill(null).map((_, i) => ({
          username: `following${i}`,
          displayName: `Following ${i}`,
          isFollowing: false,
          isBlocked: false,
        })),
        pagination: {
          cursor: null,
          nextCursor: 'nextpage',
          hasNextPage: true,
        },
      };

      (mockUsersService.getUserFollowings as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserFollowings(username, mockUser, largeLimit, undefined);

      // Assert
      expect(mockUsersService.getUserFollowings).toHaveBeenCalledWith(
        username,
        BigInt(1),
        100,
        undefined,
      );
      expect(result.items).toHaveLength(100);
    });

    it('should pass through service errors (user not found)', async () => {
      // Arrange
      const error = new Error('User not found');
      (mockUsersService.getUserFollowings as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.getUserFollowings(username, mockUser, undefined, undefined),
      ).rejects.toThrow('User not found');
    });

    it('should pass through service errors (invalid cursor)', async () => {
      // Arrange
      const invalidCursor = 'invalid!!!';
      const error = new Error('Invalid cursor format');
      (mockUsersService.getUserFollowings as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.getUserFollowings(username, mockUser, undefined, invalidCursor),
      ).rejects.toThrow('Invalid cursor format');
    });

    it('should correctly convert user id string to BigInt', async () => {
      // Arrange
      const largeUserId = '9007199254740991'; // max safe integer
      const mockServiceResult = {
        items: [],
        pagination: { cursor: null, nextCursor: null, hasNextPage: false },
      };

      (mockUsersService.getUserFollowings as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act
      await controller.getUserFollowings(username, { id: largeUserId }, undefined, undefined);

      // Assert
      expect(mockUsersService.getUserFollowings).toHaveBeenCalledWith(
        username,
        BigInt(largeUserId),
        20,
        undefined,
      );
    });
  });
  describe('GET /users/:username/mutual', () => {
    const mockUser = { id: '1' };
    const username = 'testuser';

    it('should return mutual followers with default limit (20) when no limit provided', async () => {
      // Arrange
      const mockServiceResult = {
        items: [
          {
            username: 'follower1',
            displayName: 'Follower One',
            isFollowing: true,
            isBlocked: false,
          },
          {
            username: 'follower2',
            displayName: 'Follower Two',
            isFollowing: false,
            isBlocked: false,
          },
        ],
        pagination: {
          cursor: null,
          nextCursor: 'abc123',
          hasNextPage: true,
        },
      };

      (mockUsersService.getUserMutualFollowers as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserMutualFollowers(
        username,
        mockUser,
        undefined,
        undefined,
      );

      // Assert
      expect(mockUsersService.getUserMutualFollowers).toHaveBeenCalledWith(
        username,
        BigInt(1),
        20, // default limit
        undefined, // no cursor
      );
      expect(result.items).toHaveLength(2);
      expect(result.pagination).toEqual(mockServiceResult.pagination);
    });

    it('should return mutual followers with custom limit when provided', async () => {
      // Arrange
      const customLimit = '10';
      const mockServiceResult = {
        items: [
          {
            username: 'follower1',
            displayName: 'Follower One',
            isFollowing: true,
            isBlocked: false,
          },
        ],
        pagination: {
          cursor: null,
          nextCursor: null,
          hasNextPage: false,
        },
      };

      (mockUsersService.getUserMutualFollowers as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserMutualFollowers(
        username,
        mockUser,
        customLimit,
        undefined,
      );

      // Assert
      expect(mockUsersService.getUserMutualFollowers).toHaveBeenCalledWith(
        username,
        BigInt(1),
        10, // custom limit parsed
        undefined,
      );
      expect(result.items).toHaveLength(1);
    });

    it('should return mutual followers with cursor for pagination', async () => {
      // Arrange
      const cursor = 'eyJmb2xsb3dlcklkIjoiMiIsImZvbGxvd2VkSWQiOiIxIn0='; // base64 encoded cursor
      const mockServiceResult = {
        items: [
          {
            username: 'follower3',
            displayName: 'Follower Three',
            isFollowing: false,
            isBlocked: false,
          },
        ],
        pagination: {
          cursor,
          nextCursor: null,
          hasNextPage: false,
        },
      };

      (mockUsersService.getUserMutualFollowers as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserMutualFollowers(username, mockUser, undefined, cursor);

      // Assert
      expect(mockUsersService.getUserMutualFollowers).toHaveBeenCalledWith(
        username,
        BigInt(1),
        20,
        cursor, // cursor passed through
      );
      expect(result.pagination.cursor).toBe(cursor);
    });

    it('should use default limit (20) when invalid limit provided', async () => {
      // Arrange
      const invalidLimits = ['invalid', '-5', '0', 'NaN', ''];
      const mockServiceResult = {
        items: [],
        pagination: { cursor: null, nextCursor: null, hasNextPage: false },
      };

      (mockUsersService.getUserMutualFollowers as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act & Assert
      for (const invalidLimit of invalidLimits) {
        await controller.getUserMutualFollowers(username, mockUser, invalidLimit, undefined);

        expect(mockUsersService.getUserMutualFollowers).toHaveBeenCalledWith(
          username,
          BigInt(1),
          20, // default limit used for invalid values
          undefined,
        );
      }
    });

    it('should transform items to FollowingUserDto instances', async () => {
      // Arrange
      const mockServiceResult = {
        items: [
          {
            username: 'follower1',
            displayName: 'Follower One',
            isFollowing: true,
            isBlocked: false,
          },
          {
            username: 'follower2',
            displayName: 'Follower Two',
            isFollowing: false,
            isBlocked: true,
          },
        ],
        pagination: {
          cursor: null,
          nextCursor: null,
          hasNextPage: false,
        },
      };

      (mockUsersService.getUserMutualFollowers as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserMutualFollowers(
        username,
        mockUser,
        undefined,
        undefined,
      );

      // Assert
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toHaveProperty('username', 'follower1');
      expect(result.items[0]).toHaveProperty('displayName', 'Follower One');
      expect(result.items[0]).toHaveProperty('isFollowing', true);
      expect(result.items[0]).toHaveProperty('isBlocked', false);
    });

    it('should return empty items array when user has no mutual followers', async () => {
      // Arrange
      const mockServiceResult = {
        items: [],
        pagination: {
          cursor: null,
          nextCursor: null,
          hasNextPage: false,
        },
      };

      (mockUsersService.getUserMutualFollowers as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserMutualFollowers(
        username,
        mockUser,
        undefined,
        undefined,
      );

      // Assert
      expect(mockUsersService.getUserMutualFollowers).toHaveBeenCalledWith(
        username,
        BigInt(1),
        20,
        undefined,
      );
      expect(result.items).toEqual([]);
      expect(result.pagination.hasNextPage).toBe(false);
    });

    it('should handle large limit values correctly', async () => {
      // Arrange
      const largeLimit = '100';
      const mockServiceResult = {
        items: new Array(100).fill(null).map((_, i) => ({
          username: `follower${i}`,
          displayName: `Follower ${i}`,
          isFollowing: false,
          isBlocked: false,
        })),
        pagination: {
          cursor: null,
          nextCursor: 'nextpage',
          hasNextPage: true,
        },
      };

      (mockUsersService.getUserMutualFollowers as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getUserMutualFollowers(
        username,
        mockUser,
        largeLimit,
        undefined,
      );

      // Assert
      expect(mockUsersService.getUserMutualFollowers).toHaveBeenCalledWith(
        username,
        BigInt(1),
        100,
        undefined,
      );
      expect(result.items).toHaveLength(100);
    });

    it('should pass through service errors (user not found)', async () => {
      // Arrange
      const error = new Error('User not found');
      (mockUsersService.getUserMutualFollowers as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.getUserMutualFollowers(username, mockUser, undefined, undefined),
      ).rejects.toThrow('User not found');
    });

    it('should pass through service errors (invalid cursor)', async () => {
      // Arrange
      const invalidCursor = 'invalid!!!';
      const error = new Error('Invalid cursor format');
      (mockUsersService.getUserMutualFollowers as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.getUserMutualFollowers(username, mockUser, undefined, invalidCursor),
      ).rejects.toThrow('Invalid cursor format');
    });

    it('should correctly convert user id string to BigInt', async () => {
      // Arrange
      const largeUserId = '9007199254740991'; // max safe integer
      const mockServiceResult = {
        items: [],
        pagination: { cursor: null, nextCursor: null, hasNextPage: false },
      };

      (mockUsersService.getUserMutualFollowers as jest.Mock).mockResolvedValue(mockServiceResult);

      // Act
      await controller.getUserMutualFollowers(username, { id: largeUserId }, undefined, undefined);

      // Assert
      expect(mockUsersService.getUserMutualFollowers).toHaveBeenCalledWith(
        username,
        BigInt(largeUserId),
        20,
        undefined,
      );
    });
  });

  describe('GET /users/:username/relationship', () => {
    const mockUser = { id: '1' };
    const username = 'testuser';

    it('should call usersService.getUserRelationship with correct parameters', async () => {
      // Arrange
      const expectedResult = {
        isFollowing: true,
        isFollowedBy: false,
        isBlocked: false,
        isMuted: false,
      };

      (mockUsersService.getUserRelationship as jest.Mock).mockResolvedValue(expectedResult);

      // Act
      const result = await controller.getUserRelationship(username, mockUser);

      // Assert
      expect(mockUsersService.getUserRelationship).toHaveBeenCalledWith(BigInt(1), username);
      expect(mockUsersService.getUserRelationship).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle errors thrown by usersService.getUserRelationship', async () => {
      // Arrange
      const error = new Error('User not found');
      (mockUsersService.getUserRelationship as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(controller.getUserRelationship(username, mockUser)).rejects.toThrow(
        'User not found',
      );
      expect(mockUsersService.getUserRelationship).toHaveBeenCalledWith(BigInt(1), username);
    });
  });

  describe('POST /users/:username/notify', () => {
    const mockUser = { id: '1' };
    const username = 'testuser';

    it('should call usersService.enableUserNotifications with correct parameters', async () => {
      // Arrange
      const expectedResult = { message: 'Notifications enabled successfully' };

      (mockUsersService.enableUserNotifications as jest.Mock).mockResolvedValue(expectedResult);

      // Act
      const result = await controller.enableUserNotifications(username, mockUser);

      // Assert
      expect(mockUsersService.enableUserNotifications).toHaveBeenCalledWith(BigInt(1), username);
      expect(mockUsersService.enableUserNotifications).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle errors thrown by usersService.enableUserNotifications', async () => {
      // Arrange
      const error = new Error('User not found');
      (mockUsersService.enableUserNotifications as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(controller.enableUserNotifications(username, mockUser)).rejects.toThrow(
        'User not found',
      );
      expect(mockUsersService.enableUserNotifications).toHaveBeenCalledWith(BigInt(1), username);
    });
  });

  describe('DELETE /users/:username/notify', () => {
    const mockUser = { id: '1' };
    const username = 'testuser';

    it('should call usersService.disableUserNotifications with correct parameters', async () => {
      // Arrange
      const expectedResult = { message: 'Notifications disabled successfully' };

      (mockUsersService.disableUserNotifications as jest.Mock).mockResolvedValue(expectedResult);

      // Act
      const result = await controller.disableUserNotifications(username, mockUser);

      // Assert
      expect(mockUsersService.disableUserNotifications).toHaveBeenCalledWith(BigInt(1), username);
      expect(mockUsersService.disableUserNotifications).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle errors thrown by usersService.disableUserNotifications', async () => {
      // Arrange
      const error = new Error('User not found');
      (mockUsersService.disableUserNotifications as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(controller.disableUserNotifications(username, mockUser)).rejects.toThrow(
        'User not found',
      );
      expect(mockUsersService.disableUserNotifications).toHaveBeenCalledWith(BigInt(1), username);
    });
  });

  describe('GET /users/id/:id', () => {
    const userId = '123456789';

    it('should call usersService.getUserById with correct parameters', async () => {
      // Arrange
      const expectedResult = {
        id: '123456789',
        username: 'testuser',
        displayName: 'Test User',
        bio: 'Test bio',
      };

      (mockUsersService.getUserById as jest.Mock).mockResolvedValue(expectedResult);

      // Act
      const result = await controller.getUserById(userId);

      // Assert
      expect(mockUsersService.getUserById).toHaveBeenCalledWith(BigInt(userId));
      expect(mockUsersService.getUserById).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle errors thrown by usersService.getUserById', async () => {
      // Arrange
      const error = new Error('User not found');
      (mockUsersService.getUserById as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(controller.getUserById(userId)).rejects.toThrow('User not found');
      expect(mockUsersService.getUserById).toHaveBeenCalledWith(BigInt(userId));
    });

    it('should correctly convert user id string to BigInt', async () => {
      // Arrange
      const largeUserId = '9007199254740991'; // max safe integer
      const expectedResult = {
        id: largeUserId,
        username: 'testuser',
        displayName: 'Test User',
      };

      (mockUsersService.getUserById as jest.Mock).mockResolvedValue(expectedResult);

      // Act
      await controller.getUserById(largeUserId);

      // Assert
      expect(mockUsersService.getUserById).toHaveBeenCalledWith(BigInt(largeUserId));
    });
  });
});
