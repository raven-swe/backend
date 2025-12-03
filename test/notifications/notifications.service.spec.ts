import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationsRepository } from 'src/notifications/notifications.repository';
import { TweetsRepository } from 'src/tweets/tweets.repository';
import { PAGINATION_ERROR_CODES, PAGINATION_ERROR_MESSAGES } from 'src/common/constants';

describe('NotificationsService', () => {
  let service: NotificationsService;
  const mockNotificationsRepository: jest.Mocked<Partial<NotificationsRepository>> = {
    createNotification: jest.fn(),
    findExisting: jest.fn(),
    findById: jest.fn(),
    markAllAsSeen: jest.fn(),
    markAsSeen: jest.fn(),
    getUnseenCount: jest.fn(),
    getNotifications: jest.fn(),
  };

  const mockTweetsRepository: jest.Mocked<Partial<TweetsRepository>> = {
    mapToTweetDto: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationsRepository, useValue: mockNotificationsRepository },
        { provide: TweetsRepository, useValue: mockTweetsRepository },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('trigger', () => {
    it('should create a notification if none exists and actorId != receiverId', async () => {
      const mockNotification = { actorId: '1', receiverId: '2', type: 'LIKE' };
      (mockNotificationsRepository.findExisting as jest.Mock).mockResolvedValue(null);
      (mockNotificationsRepository.createNotification as jest.Mock).mockResolvedValue(
        mockNotification,
      );

      const result = await service.trigger({
        actorId: BigInt(mockNotification.actorId),
        receiverId: BigInt(mockNotification.receiverId),
        type: 'LIKE',
      });

      expect(mockNotificationsRepository.findExisting).toHaveBeenCalledWith({
        actorId: BigInt(mockNotification.actorId),
        receiverId: BigInt(mockNotification.receiverId),
        type: 'LIKE',
      });
      expect(mockNotificationsRepository.createNotification).toHaveBeenCalledWith({
        actorId: BigInt(mockNotification.actorId),
        receiverId: BigInt(mockNotification.receiverId),
        type: 'LIKE',
      });
      expect(result).toEqual(mockNotification);
    });

    it('should return existing notification if found', async () => {
      const mockNotification = { actorId: '1', receiverId: '2', type: 'LIKE' };
      (mockNotificationsRepository.findExisting as jest.Mock).mockResolvedValue(mockNotification);

      const result = await service.trigger({
        actorId: BigInt(mockNotification.actorId),
        receiverId: BigInt(mockNotification.receiverId),
        type: 'LIKE',
      });

      expect(mockNotificationsRepository.findExisting).toHaveBeenCalledWith({
        actorId: BigInt(mockNotification.actorId),
        receiverId: BigInt(mockNotification.receiverId),
        type: 'LIKE',
      });
      expect(mockNotificationsRepository.createNotification).not.toHaveBeenCalled();
      expect(result).toEqual(mockNotification);
    });

    it('should not create notification if actorId equals receiverId', async () => {
      const mockNotification = { actorId: '1', receiverId: '1', type: 'LIKE' };
      const result = await service.trigger({
        actorId: BigInt(mockNotification.actorId),
        receiverId: BigInt(mockNotification.receiverId),
        type: 'LIKE',
      });

      expect(mockNotificationsRepository.findExisting).not.toHaveBeenCalled();
      expect(mockNotificationsRepository.createNotification).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe('markAllAsSeen', () => {
    it('should call repository to mark all as seen', async () => {
      (mockNotificationsRepository.markAllAsSeen as jest.Mock).mockResolvedValue({ count: 5 });

      const result = await service.markAllAsSeen(BigInt('2'));

      expect(mockNotificationsRepository.markAllAsSeen).toHaveBeenCalledWith(BigInt('2'));
      expect(result).toBe(5);
    });
  });

  describe('markAsSeen', () => {
    it('should call repository to mark a notification as seen', async () => {
      (mockNotificationsRepository.markAsSeen as jest.Mock).mockResolvedValue({ count: 1 });
      (mockNotificationsRepository.findById as jest.Mock).mockResolvedValue({ id: BigInt('1') });

      const result = await service.markAsSeen(BigInt('1'), BigInt('2'));
      expect(mockNotificationsRepository.markAsSeen).toHaveBeenCalledWith(BigInt('1'), BigInt('2'));
      expect(result).toBe(1);
    });

    it('should fail when notification is not found', async () => {
      (mockNotificationsRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.markAsSeen(BigInt('1'), BigInt('2'))).rejects.toThrow(
        'Notification not found',
      );
    });
  });
  describe('getUnseenCount', () => {
    it('should call repository to get unseen count', async () => {
      (mockNotificationsRepository.getUnseenCount as jest.Mock).mockResolvedValue(3);

      const result = await service.getUnseenCount(BigInt('1'));

      expect(mockNotificationsRepository.getUnseenCount).toHaveBeenCalledWith(BigInt('1'));
      expect(result).toEqual(3);
    });
  });

  describe('getNotifications', () => {
    const userId = BigInt(1);
    const mockNotification = {
      id: BigInt(1),
      type: 'LIKE',
      actor: {
        username: 'testuser',
        profile: {
          displayName: 'Test User',
          avatarUrl: 'http://example.com/avatar.jpg',
        },
      },
      tweet: {
        id: BigInt(100),
        content: 'Test tweet',
        userId: BigInt(2),
      },
      latestEventAt: new Date('2024-01-01'),
      seen: false,
    };

    const mockFollowNotification = {
      id: BigInt(2),
      type: 'FOLLOW',
      actor: {
        username: 'follower',
        profile: {
          displayName: 'Follower User',
          avatarUrl: 'http://example.com/avatar2.jpg',
        },
      },
      tweet: null,
      latestEventAt: new Date('2024-01-02'),
      seen: true,
    };

    beforeEach(() => {
      (mockTweetsRepository.mapToTweetDto as jest.Mock).mockImplementation((tweet) => ({
        id: tweet.id.toString(),
        content: tweet.content,
        userId: tweet.userId.toString(),
      }));
    });

    it('should work correctly with no cursor or limit', async () => {
      (mockNotificationsRepository.getNotifications as jest.Mock).mockResolvedValue([
        mockNotification,
      ]);

      const result = await service.getNotifications(userId);

      expect(mockNotificationsRepository.getNotifications).toHaveBeenCalledWith(
        userId,
        21, // default limit + 1
        undefined,
        undefined,
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: '1',
        type: 'LIKE',
        actorSummary: {
          totalCount: 1,
          previewActors: [
            {
              username: 'testuser',
              displayName: 'Test User',
              avatarUrl: 'http://example.com/avatar.jpg',
            },
          ],
        },
        tweetSummary: {
          totalCount: 1,
          subjectIds: ['100'],
          primaryTweet: {
            id: '100',
            content: 'Test tweet',
            userId: '2',
          },
        },
        isSeen: false,
      });
      expect(result.pagination.hasNextPage).toBe(false);
    });

    it('should work correctly with cursor and limit with correct length', async () => {
      const cursor = Buffer.from(
        JSON.stringify({ id: '5', lastEventAt: new Date('2024-01-01').toISOString() }),
      ).toString('base64');
      const limit = 10;

      const notifications = Array.from({ length: 11 }, (_, i) => ({
        ...mockNotification,
        id: BigInt(i + 1),
      }));

      (mockNotificationsRepository.getNotifications as jest.Mock).mockResolvedValue(notifications);

      const result = await service.getNotifications(userId, limit, cursor);

      expect(mockNotificationsRepository.getNotifications).toHaveBeenCalledWith(
        userId,
        11, // limit + 1
        { id: '5', lastEventAt: new Date('2024-01-01').toISOString() },
        undefined,
      );
      expect(result.items).toHaveLength(10); // items are sliced to the limit
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.nextCursor).toBeDefined();
    });

    it('should work correctly with no filter', async () => {
      (mockNotificationsRepository.getNotifications as jest.Mock).mockResolvedValue([
        mockNotification,
      ]);

      await service.getNotifications(userId, 20, undefined, undefined);

      expect(mockNotificationsRepository.getNotifications).toHaveBeenCalledWith(
        userId,
        21,
        undefined,
        undefined,
      );
    });

    it('should work correctly with mentions filter', async () => {
      const mockNotification = {
        id: BigInt(1),
        type: 'MENTION',
        actor: {
          username: 'testuser',
          profile: {
            displayName: 'Test User',
            avatarUrl: 'http://example.com/avatar.jpg',
          },
        },
        tweet: {
          id: BigInt(100),
          content: 'Test tweet',
          userId: BigInt(2),
        },
        latestEventAt: new Date('2024-01-01'),
        seen: false,
      };

      (mockNotificationsRepository.getNotifications as jest.Mock).mockResolvedValue([
        mockNotification,
      ]);

      const result = await service.getNotifications(userId, 20, undefined, 'mentions');

      expect(mockNotificationsRepository.getNotifications).toHaveBeenCalledWith(
        userId,
        21,
        undefined,
        'mentions',
      );

      expect(result.items[0].type).toBe('MENTION');
    });

    it('should throw error if filter is not mentions', async () => {
      await expect(service.getNotifications(userId, 20, undefined, 'invalid')).rejects.toThrow(
        new HttpException(
          {
            message: PAGINATION_ERROR_MESSAGES.INVALID_FILTER,
            code: PAGINATION_ERROR_CODES.INVALID_FILTER,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );

      expect(mockNotificationsRepository.getNotifications).not.toHaveBeenCalled();
    });

    it('should throw error if cant parse cursor', async () => {
      const invalidCursor = 'invalid-cursor';

      await expect(service.getNotifications(userId, 20, invalidCursor)).rejects.toThrow(
        new HttpException(
          {
            message: PAGINATION_ERROR_MESSAGES.INVALID_CURSOR,
            code: PAGINATION_ERROR_CODES.INVALID_CURSOR,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );

      expect(mockNotificationsRepository.getNotifications).not.toHaveBeenCalled();
    });

    it('should have tweetSummary with 0 total count and null primaryTweet for FOLLOW type', async () => {
      (mockNotificationsRepository.getNotifications as jest.Mock).mockResolvedValue([
        mockFollowNotification,
      ]);

      const result = await service.getNotifications(userId);

      expect(result.items[0].tweetSummary).toEqual({
        totalCount: 0,
        subjectIds: [],
        primaryTweet: null,
      });
      expect(mockTweetsRepository.mapToTweetDto).not.toHaveBeenCalled();
    });

    it('should handle empty notifications list', async () => {
      (mockNotificationsRepository.getNotifications as jest.Mock).mockResolvedValue([]);

      const result = await service.getNotifications(userId);

      expect(result.items).toEqual([]);
      expect(result.pagination.hasNextPage).toBe(false);
    });

    it('should handle notification with null profile fields', async () => {
      const notificationWithNullProfile = {
        ...mockNotification,
        actor: {
          username: 'testuser',
          profile: {
            displayName: null,
            avatarUrl: null,
          },
        },
      };

      (mockNotificationsRepository.getNotifications as jest.Mock).mockResolvedValue([
        notificationWithNullProfile,
      ]);

      const result = await service.getNotifications(userId);

      expect(result.items[0].actorSummary.previewActors[0]).toEqual({
        username: 'testuser',
        displayName: null,
        avatarUrl: null,
      });
    });

    it('should properly map tweet when present', async () => {
      (mockNotificationsRepository.getNotifications as jest.Mock).mockResolvedValue([
        mockNotification,
      ]);

      await service.getNotifications(userId);

      expect(mockTweetsRepository.mapToTweetDto).toHaveBeenCalledWith(mockNotification.tweet);
    });
  });
});
