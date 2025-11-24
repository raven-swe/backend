import { Test, TestingModule } from '@nestjs/testing';
import { ProfileTweetsController } from 'src/tweets/profile-tweets.controller';
import { TweetsService } from 'src/tweets/tweets.service';

describe('ProfileTweetsController', () => {
  let controller: ProfileTweetsController;

  const mockTweetsService = {
    getUserPosts: jest.fn(),
    getUserPostsAndReplies: jest.fn(),
  };

  const mockUser = { id: '1' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileTweetsController],
      providers: [
        {
          provide: TweetsService,
          useValue: mockTweetsService,
        },
      ],
    }).compile();

    controller = module.get<ProfileTweetsController>(ProfileTweetsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserPosts', () => {
    const username = 'testuser';

    it('should use default limit (20) when limit is invalid', async () => {
      const invalidLimits = ['invalid', '-5', '0', 'NaN', ''];
      mockTweetsService.getUserPosts.mockResolvedValue({ items: [], pagination: {} });

      for (const invalidLimit of invalidLimits) {
        await controller.getUserPosts(username, mockUser, invalidLimit, undefined);

        expect(mockTweetsService.getUserPosts).toHaveBeenCalledWith(
          username,
          BigInt(1),
          20, // default
          undefined,
        );
      }
    });

    it('should parse valid limit correctly', async () => {
      mockTweetsService.getUserPosts.mockResolvedValue({ items: [], pagination: {} });

      await controller.getUserPosts(username, mockUser, '50', undefined);

      expect(mockTweetsService.getUserPosts).toHaveBeenCalledWith(
        username,
        BigInt(1),
        50,
        undefined,
      );
    });

    it('should pass cursor through to service', async () => {
      const cursor = 'validCursor123';
      mockTweetsService.getUserPosts.mockResolvedValue({ items: [], pagination: {} });

      await controller.getUserPosts(username, mockUser, undefined, cursor);

      expect(mockTweetsService.getUserPosts).toHaveBeenCalledWith(username, BigInt(1), 20, cursor);
    });

    it('should convert user.id string to BigInt', async () => {
      const largeUserId = '9007199254740991';
      mockTweetsService.getUserPosts.mockResolvedValue({ items: [], pagination: {} });

      await controller.getUserPosts(username, { id: largeUserId }, undefined, undefined);

      expect(mockTweetsService.getUserPosts).toHaveBeenCalledWith(
        username,
        BigInt(largeUserId),
        20,
        undefined,
      );
    });

    it('should propagate service errors', async () => {
      const error = new Error('User not found');
      mockTweetsService.getUserPosts.mockRejectedValue(error);

      await expect(
        controller.getUserPosts(username, mockUser, undefined, undefined),
      ).rejects.toThrow('User not found');
    });
  });

  describe('getUserReplies', () => {
    const username = 'testuser';

    it('should use default limit (20) when limit is invalid', async () => {
      const invalidLimits = ['invalid', '-5', '0', 'NaN', ''];
      mockTweetsService.getUserPostsAndReplies.mockResolvedValue({ items: [], pagination: {} });

      for (const invalidLimit of invalidLimits) {
        await controller.getUserReplies(username, mockUser, invalidLimit, undefined);

        expect(mockTweetsService.getUserPostsAndReplies).toHaveBeenCalledWith(
          username,
          BigInt(1),
          20, // default
          undefined,
        );
      }
    });

    it('should parse valid limit correctly', async () => {
      mockTweetsService.getUserPostsAndReplies.mockResolvedValue({ items: [], pagination: {} });

      await controller.getUserReplies(username, mockUser, '50', undefined);

      expect(mockTweetsService.getUserPostsAndReplies).toHaveBeenCalledWith(
        username,
        BigInt(1),
        50,
        undefined,
      );
    });

    it('should pass cursor through to service', async () => {
      const cursor = 'validCursor123';
      mockTweetsService.getUserPostsAndReplies.mockResolvedValue({ items: [], pagination: {} });

      await controller.getUserReplies(username, mockUser, undefined, cursor);

      expect(mockTweetsService.getUserPostsAndReplies).toHaveBeenCalledWith(
        username,
        BigInt(1),
        20,
        cursor,
      );
    });

    it('should convert user.id string to BigInt', async () => {
      const largeUserId = '9007199254740991';
      mockTweetsService.getUserPostsAndReplies.mockResolvedValue({ items: [], pagination: {} });

      await controller.getUserReplies(username, { id: largeUserId }, undefined, undefined);

      expect(mockTweetsService.getUserPostsAndReplies).toHaveBeenCalledWith(
        username,
        BigInt(largeUserId),
        20,
        undefined,
      );
    });

    it('should propagate service errors', async () => {
      const error = new Error('Invalid cursor format');
      mockTweetsService.getUserPostsAndReplies.mockRejectedValue(error);

      await expect(
        controller.getUserReplies(username, mockUser, undefined, undefined),
      ).rejects.toThrow('Invalid cursor format');
    });
  });
});
