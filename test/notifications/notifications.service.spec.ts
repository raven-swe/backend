import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { NotificationsService } from 'src/notifications/notifications.service';
import {
  NotificationsRepository,
  NotificationWithDetails,
} from 'src/notifications/notifications.repository';
import { PAGINATION_ERROR_CODES, PAGINATION_ERROR_MESSAGES } from 'src/common/constants';
import {
  NOTIFICATIONS_ERROR_CODES,
  NOTIFICATIONS_ERROR_MESSAGES,
} from 'src/notifications/constants';
import { SseEventsService } from 'src/sse/sse-events.service';
import { UsersRepository } from 'src/users/users.repository';
import { getQueueToken } from '@nestjs/bullmq';

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
    mapToNotificationDto: jest.fn(),
    findOpenNotification: jest.fn(),
    updtateNotificationByIdAggregation: jest.fn(),
    deleteExisting: jest.fn(),
    deleteById: jest.fn(),
  };

  const mockSseEventsService: jest.Mocked<Partial<SseEventsService>> = {
    publishNewNotification: jest.fn(),
    publishNotificationSeen: jest.fn(),
    publishNotificationDeleted: jest.fn(),
    publishNotificationUpdate: jest.fn(),
  };
  const mockUsersRepository: jest.Mocked<Partial<UsersRepository>> = {
    isBlocked: jest.fn(),
    getUsersMetadataById: jest.fn(),
  };
  const mockNotificationsQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationsRepository, useValue: mockNotificationsRepository },
        { provide: SseEventsService, useValue: mockSseEventsService },
        { provide: UsersRepository, useValue: mockUsersRepository },
        { provide: getQueueToken('notifications'), useValue: mockNotificationsQueue },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('trigger', () => {
    const userId = BigInt(10);
    const mockNotification = {
      id: BigInt(1),
      type: 'LIKE',
      actor: {
        username: 'testuser',
        profile: {
          displayName: 'Test User',
          avatarUrl: 'http://example.com/avatar.jpg',
        },
        followers: [{ followerId: userId, followedId: BigInt(2) }],
      },
      tweet: {
        id: BigInt(100),
        content: 'Test tweet',
        userId: BigInt(2),
      },
      latestEventAt: new Date('2024-01-01'),
      seen: false,
    };
    const mockTriggerOpitions = {
      actorId: BigInt(1),
      receiverId: BigInt(userId),
      tweetId: BigInt(3),
      type: 'LIKE' as const,
    };
    it('should create a notification if none exists and actorId != receiverId', async () => {
      const dedupeKey = `${mockTriggerOpitions.type}:TWEET:${mockTriggerOpitions.tweetId}`;

      (mockNotificationsRepository.findExisting as jest.Mock).mockResolvedValue(null);
      (mockNotificationsRepository.findOpenNotification as jest.Mock).mockResolvedValue(null);
      (mockNotificationsRepository.createNotification as jest.Mock).mockResolvedValue(
        mockNotification,
      );

      const result = await service.trigger(mockTriggerOpitions);

      expect(mockNotificationsRepository.findExisting).toHaveBeenCalledWith(mockTriggerOpitions);
      expect(mockNotificationsRepository.findOpenNotification).toHaveBeenCalledWith(
        mockTriggerOpitions.receiverId,
        dedupeKey,
      );

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
        followers: [{ followerId: userId, followedId: BigInt(1) }],
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
        followers: [{ followerId: userId, followedId: BigInt(2) }],
      },
      tweet: null,
      latestEventAt: new Date('2024-01-02'),
      seen: true,
    };

    beforeEach(() => {
      (mockNotificationsRepository.mapToNotificationDto as jest.Mock).mockImplementation(
        (notification: NotificationWithDetails) => {
          return {
            id: notification.id.toString(),
            type: notification.type,
            actorSummary: {
              totalCount: 1,
              previewActors: [
                {
                  username: notification.actor.username,
                  displayName: notification.actor.profile?.displayName,
                  avatarUrl: notification.actor.profile?.avatarUrl,
                  isFollowing: notification.actor.followers.length > 0,
                },
              ],
            },
            tweetSummary:
              notification.type === 'FOLLOW'
                ? { totalCount: 0, primaryTweet: null }
                : {
                    totalCount: 1,
                    primaryTweet: {
                      id: notification.tweet?.id.toString(),
                      content: notification.tweet?.content,
                      userId: notification.tweet?.userId.toString(),
                    },
                  },
            isSeen: notification.seen,
          };
        },
      );
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
              isFollowing: true,
            },
          ],
        },
        tweetSummary: {
          totalCount: 1,
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
          followers: [{ followerId: userId, followedId: BigInt(2) }],
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
        primaryTweet: null,
      });
      // expect(mockTweetsRepository.mapToTweetDto).not.toHaveBeenCalled();
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
          followers: [{ followerId: userId, followedId: BigInt(2) }],
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
        isFollowing: true,
      });
    });
  });

  describe('trigger - advanced scenarios', () => {
    const userId = BigInt(10);
    const actorId = BigInt(1);
    const tweetId = BigInt(100);

    it('should not create notification if receiver has blocked actor', async () => {
      const options = {
        actorId,
        receiverId: userId,
        tweetId,
        type: 'LIKE' as const,
      };

      mockUsersRepository.isBlocked.mockResolvedValue(true);

      const result = await service.trigger(options);

      expect(mockUsersRepository.isBlocked).toHaveBeenCalledWith(userId, actorId);
      expect(mockNotificationsRepository.findExisting).not.toHaveBeenCalled();
      expect(mockNotificationsRepository.createNotification).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should aggregate notification when open notification exists with same dedupe key', async () => {
      const options = {
        actorId,
        receiverId: userId,
        tweetId,
        type: 'LIKE' as const,
      };

      const existingNotification = {
        id: BigInt(50),
        type: 'LIKE',
        actorId: BigInt(2),
        actor: {
          id: BigInt(2),
          username: 'previoususer',
          profile: {
            displayName: 'Previous User',
            avatarUrl: 'http://example.com/prev.jpg',
          },
          followers: [],
        },
        payload: {
          actorsIds: ['2'],
          actorsPreview: [
            {
              id: '2',
              username: 'previoususer',
              displayName: 'Previous User',
              avatarUrl: 'http://example.com/prev.jpg',
              ifFollowing: false,
            },
          ],
        },
      };

      const updatedNotification = {
        ...existingNotification,
        actorId,
        payload: {
          count: 2,
          actorsIds: ['2', '1'],
          actorsPreview: [
            {
              id: '2',
              username: 'previoususer',
              displayName: 'Previous User',
              avatarUrl: 'http://example.com/prev.jpg',
              ifFollowing: false,
            },
          ],
        },
      };

      mockUsersRepository.isBlocked.mockResolvedValue(false);
      mockNotificationsRepository.findExisting.mockResolvedValue(null);
      mockNotificationsRepository.findOpenNotification.mockResolvedValue(existingNotification);
      mockNotificationsRepository.updtateNotificationByIdAggregation.mockResolvedValue(
        updatedNotification,
      );
      mockNotificationsRepository.getUnseenCount.mockResolvedValue(5);
      mockNotificationsRepository.mapToNotificationDto.mockReturnValue({
        id: '50',
        type: 'LIKE',
      } as any);

      const result = await service.trigger(options);

      expect(mockNotificationsRepository.findOpenNotification).toHaveBeenCalledWith(
        userId,
        'LIKE:TWEET:100',
      );
      expect(mockNotificationsRepository.updtateNotificationByIdAggregation).toHaveBeenCalled();
      expect(mockSseEventsService.publishNewNotification).toHaveBeenCalled();
      expect(mockNotificationsQueue.add).toHaveBeenCalledWith(
        'sendPush',
        expect.objectContaining({
          notificationId: '50',
          userId: userId.toString(),
        }),
        expect.objectContaining({
          jobId: `PUSH_${userId}_LIKE:TWEET:${tweetId}`,
        }),
      );
      expect(result).toBeDefined();
    });

    it('should limit actors preview to 3 when aggregating', async () => {
      const options = {
        actorId: BigInt(5),
        receiverId: userId,
        tweetId,
        type: 'LIKE' as const,
      };

      const existingNotification = {
        id: BigInt(50),
        type: 'LIKE',
        actorId: BigInt(2),
        actor: {
          id: BigInt(2),
          username: 'user2',
          profile: { displayName: 'User 2', avatarUrl: 'http://example.com/2.jpg' },
          followers: [],
        },
        payload: {
          actorsIds: ['2', '3', '4'],
          actorsPreview: [
            {
              id: '2',
              username: 'user2',
              displayName: 'User 2',
              avatarUrl: 'http://example.com/2.jpg',
              ifFollowing: false,
            },
            {
              id: '3',
              username: 'user3',
              displayName: 'User 3',
              avatarUrl: 'http://example.com/3.jpg',
              ifFollowing: false,
            },
            {
              id: '4',
              username: 'user4',
              displayName: 'User 4',
              avatarUrl: 'http://example.com/4.jpg',
              ifFollowing: false,
            },
          ],
        },
      };

      mockUsersRepository.isBlocked.mockResolvedValue(false);
      mockNotificationsRepository.findExisting.mockResolvedValue(null);
      mockNotificationsRepository.findOpenNotification.mockResolvedValue(existingNotification);
      mockNotificationsRepository.updtateNotificationByIdAggregation.mockResolvedValue({
        ...existingNotification,
        id: BigInt(50),
      });
      mockNotificationsRepository.getUnseenCount.mockResolvedValue(5);
      mockNotificationsRepository.mapToNotificationDto.mockReturnValue({ id: '50' } as any);

      await service.trigger(options);

      const updateCall =
        mockNotificationsRepository.updtateNotificationByIdAggregation.mock.calls[0];
      const payload = updateCall[2] as any;

      // Should only keep first 2 actors when adding 5th actor
      expect(payload.actorsPreview.length).toBeLessThanOrEqual(2);
    });

    it('should create new notification for non-aggregatable types', async () => {
      const options = {
        actorId,
        receiverId: userId,
        tweetId,
        type: 'REPLY' as const,
      };

      const newNotification = {
        id: BigInt(100),
        type: 'REPLY',
        actorId,
      };

      mockUsersRepository.isBlocked.mockResolvedValue(false);
      mockNotificationsRepository.findExisting.mockResolvedValue(null);
      mockNotificationsRepository.createNotification.mockResolvedValue(newNotification);
      mockNotificationsRepository.getUnseenCount.mockResolvedValue(3);
      mockNotificationsRepository.mapToNotificationDto.mockReturnValue({ id: '100' } as any);

      await service.trigger(options);

      expect(mockNotificationsRepository.createNotification).toHaveBeenCalledWith(
        options,
        expect.objectContaining({
          actorsIds: [actorId.toString()],
          actorsPreview: [],
        }),
        null, // no dedupe key for REPLY
      );
      expect(mockNotificationsQueue.add).toHaveBeenCalledWith(
        'sendPush',
        expect.any(Object),
        expect.objectContaining({
          jobId: `PUSH_${userId}_${newNotification.id}`,
        }),
      );
    });

    it('should enqueue push notification with proper configuration', async () => {
      const options = {
        actorId,
        receiverId: userId,
        tweetId,
        type: 'LIKE' as const,
      };

      const notification = { id: BigInt(99) };

      mockUsersRepository.isBlocked.mockResolvedValue(false);
      mockNotificationsRepository.findExisting.mockResolvedValue(null);
      mockNotificationsRepository.findOpenNotification.mockResolvedValue(null);
      mockNotificationsRepository.createNotification.mockResolvedValue(notification);
      mockNotificationsRepository.getUnseenCount.mockResolvedValue(1);
      mockNotificationsRepository.mapToNotificationDto.mockReturnValue({ id: '99' } as any);

      await service.trigger(options);

      expect(mockNotificationsQueue.add).toHaveBeenCalledWith(
        'sendPush',
        {
          notificationId: '99',
          userId: userId.toString(),
        },
        {
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          jobId: `PUSH_${userId}_LIKE:TWEET:${tweetId}`,
          delay: 2000,
          removeOnFail: false,
        },
      );
    });
  });

  describe('handleUndo', () => {
    const actorId = BigInt(1);
    const receiverId = BigInt(10);
    const tweetId = BigInt(100);

    it('should delete notification when no dedupe key exists', async () => {
      const options = {
        actorId,
        receiverId,
        tweetId,
        type: 'REPLY' as const,
      };

      mockNotificationsRepository.deleteExisting.mockResolvedValue(undefined);
      mockNotificationsRepository.getUnseenCount.mockResolvedValue(2);

      await service.handleUndo(options);

      expect(mockNotificationsRepository.deleteExisting).toHaveBeenCalledWith(options);
      expect(mockSseEventsService.publishNotificationDeleted).toHaveBeenCalledWith(receiverId, 2);
    });

    it('should delete notification when no open notification found with dedupe key', async () => {
      const options = {
        actorId,
        receiverId,
        tweetId,
        type: 'LIKE' as const,
      };

      mockNotificationsRepository.findOpenNotification.mockResolvedValue(null);
      mockNotificationsRepository.deleteExisting.mockResolvedValue(undefined);
      mockNotificationsRepository.getUnseenCount.mockResolvedValue(1);

      await service.handleUndo(options);

      expect(mockNotificationsRepository.findOpenNotification).toHaveBeenCalledWith(
        receiverId,
        'LIKE:TWEET:100',
      );
      expect(mockNotificationsRepository.deleteExisting).toHaveBeenCalledWith(options);
      expect(mockSseEventsService.publishNotificationDeleted).toHaveBeenCalledWith(receiverId, 1);
    });

    it('should do nothing when actor was not in notification', async () => {
      const options = {
        actorId,
        receiverId,
        tweetId,
        type: 'LIKE' as const,
      };

      const notification = {
        id: BigInt(50),
        actor: {
          id: BigInt(2),
          username: 'other',
          profile: { displayName: 'Other', avatarUrl: 'url' },
          followers: [],
        },
        payload: {
          actorsIds: ['2', '3'],
          actorsPreview: [],
        },
      };

      mockNotificationsRepository.findOpenNotification.mockResolvedValue(notification);

      await service.handleUndo(options);

      expect(mockNotificationsRepository.deleteById).not.toHaveBeenCalled();
      expect(mockNotificationsRepository.updtateNotificationByIdAggregation).not.toHaveBeenCalled();
    });

    it('should delete notification when removing last actor', async () => {
      const options = {
        actorId,
        receiverId,
        tweetId,
        type: 'LIKE' as const,
      };

      const notification = {
        id: BigInt(50),
        actor: {
          id: actorId,
          username: 'user',
          profile: { displayName: 'User', avatarUrl: 'url' },
          followers: [],
        },
        payload: {
          actorsIds: ['1'],
          actorsPreview: [],
        },
      };

      mockNotificationsRepository.findOpenNotification.mockResolvedValue(notification);
      mockNotificationsRepository.deleteById.mockResolvedValue(undefined);
      mockNotificationsRepository.getUnseenCount.mockResolvedValue(0);

      await service.handleUndo(options);

      expect(mockNotificationsRepository.deleteById).toHaveBeenCalledWith(BigInt(50));
      expect(mockSseEventsService.publishNotificationDeleted).toHaveBeenCalledWith(receiverId, 0);
    });

    it('should update notification when removing one of multiple actors', async () => {
      const options = {
        actorId,
        receiverId,
        tweetId,
        type: 'LIKE' as const,
      };

      const notification = {
        id: BigInt(50),
        actor: {
          id: actorId,
          username: 'user1',
          profile: { displayName: 'User 1', avatarUrl: 'url1' },
          followers: [],
        },
        payload: {
          actorsIds: ['1', '2'],
          actorsPreview: [
            {
              id: '2',
              username: 'user2',
              displayName: 'User 2',
              avatarUrl: 'url2',
              ifFollowing: false,
            },
          ],
        },
      };

      const updatedNotification = {
        ...notification,
        actorId: BigInt(2),
        payload: {
          count: 1,
          actorsIds: ['2'],
          actorsPreview: [],
        },
      };

      mockNotificationsRepository.findOpenNotification.mockResolvedValue(notification);
      mockNotificationsRepository.updtateNotificationByIdAggregation.mockResolvedValue(
        updatedNotification,
      );
      mockNotificationsRepository.getUnseenCount.mockResolvedValue(5);
      mockNotificationsRepository.mapToNotificationDto.mockReturnValue({ id: '50' } as any);

      await service.handleUndo(options);

      expect(mockNotificationsRepository.updtateNotificationByIdAggregation).toHaveBeenCalledWith(
        BigInt(50),
        expect.objectContaining({
          actorId: BigInt(2),
        }),
        expect.objectContaining({
          count: 1,
          actorsIds: ['2'],
        }),
        false,
      );
      expect(mockSseEventsService.publishNotificationUpdate).toHaveBeenCalledWith(
        receiverId,
        { id: '50' },
        5,
      );
      expect(mockNotificationsQueue.add).toHaveBeenCalled();
    });

    it('should fetch new actors when actors preview needs refilling after undo', async () => {
      const options = {
        actorId: BigInt(5),
        receiverId,
        tweetId,
        type: 'LIKE' as const,
      };

      const notification = {
        id: BigInt(50),
        actor: {
          id: BigInt(2),
          username: 'user2',
          profile: { displayName: 'User 2', avatarUrl: 'url2' },
          followers: [],
        },
        payload: {
          actorsIds: ['2', '3', '4', '5'],
          actorsPreview: [
            {
              id: '3',
              username: 'user3',
              displayName: 'User 3',
              avatarUrl: 'url3',
              ifFollowing: false,
            },
          ],
        },
      };

      const newUser = {
        id: BigInt(4),
        username: 'user4',
        profile: { displayName: 'User 4', avatarUrl: 'url4' },
      };

      mockNotificationsRepository.findOpenNotification.mockResolvedValue(notification);
      mockUsersRepository.getUsersMetadataById.mockResolvedValue([newUser]);
      mockNotificationsRepository.updtateNotificationByIdAggregation.mockResolvedValue({
        ...notification,
        id: BigInt(50),
      });
      mockNotificationsRepository.getUnseenCount.mockResolvedValue(3);
      mockNotificationsRepository.mapToNotificationDto.mockReturnValue({ id: '50' } as any);

      await service.handleUndo(options);

      // After removing 5, we have 3 actors left, actorsMap has 1 preview (3)
      // facingActorId is 2, so actorsMap.delete(2) leaves actorsMap with just [3]
      // Condition: actorsMap.size (1) < 3 && actorsIdsSet.size (3) > actorsMap.size (1) + 1 = 3 > 2 is true
      // So it should fetch actor 4
      expect(mockUsersRepository.getUsersMetadataById).toHaveBeenCalledWith([BigInt(4)]);
    });

    it('should change facing actor when undoing current facing actor', async () => {
      const options = {
        actorId: BigInt(2),
        receiverId,
        tweetId,
        type: 'LIKE' as const,
      };

      const notification = {
        id: BigInt(50),
        actor: {
          id: BigInt(2),
          username: 'user2',
          profile: { displayName: 'User 2', avatarUrl: 'url2' },
          followers: [],
        },
        payload: {
          actorsIds: ['2', '3'],
          actorsPreview: [
            {
              id: '3',
              username: 'user3',
              displayName: 'User 3',
              avatarUrl: 'url3',
              ifFollowing: false,
            },
          ],
        },
      };

      mockNotificationsRepository.findOpenNotification.mockResolvedValue(notification);
      mockNotificationsRepository.updtateNotificationByIdAggregation.mockResolvedValue({
        ...notification,
        actorId: BigInt(3),
      });
      mockNotificationsRepository.getUnseenCount.mockResolvedValue(2);
      mockNotificationsRepository.mapToNotificationDto.mockReturnValue({ id: '50' } as any);

      await service.handleUndo(options);

      const updateCall =
        mockNotificationsRepository.updtateNotificationByIdAggregation.mock.calls[0];
      const updatedOptions = updateCall[1];
      expect(updatedOptions.actorId).toEqual(BigInt(3));
    });
  });

  describe('handleTweetDeletionNotifications', () => {
    it('should publish deletion events for all receivers', async () => {
      const receivers = [
        { receiverId: BigInt(1), unseenCount: 3 },
        { receiverId: BigInt(2), unseenCount: 5 },
        { receiverId: BigInt(3), unseenCount: 0 },
      ];

      await service.handleTweetDeletionNotifications(receivers);

      expect(mockSseEventsService.publishNotificationDeleted).toHaveBeenCalledTimes(3);
      expect(mockSseEventsService.publishNotificationDeleted).toHaveBeenCalledWith(BigInt(1), 3);
      expect(mockSseEventsService.publishNotificationDeleted).toHaveBeenCalledWith(BigInt(2), 5);
      expect(mockSseEventsService.publishNotificationDeleted).toHaveBeenCalledWith(BigInt(3), 0);
    });

    it('should handle empty receivers array', async () => {
      await service.handleTweetDeletionNotifications([]);

      expect(mockSseEventsService.publishNotificationDeleted).not.toHaveBeenCalled();
    });
  });

  describe('markAllAsSeen - extended', () => {
    it('should publish SSE event after marking all as seen', async () => {
      const userId = BigInt(10);
      mockNotificationsRepository.markAllAsSeen.mockResolvedValue({ count: 5 });

      await service.markAllAsSeen(userId);

      expect(mockNotificationsRepository.markAllAsSeen).toHaveBeenCalledWith(userId);
      expect(mockSseEventsService.publishNotificationSeen).toHaveBeenCalledWith(userId);
    });
  });

  describe('markAsSeen - extended', () => {
    it('should throw NOT_FOUND error when notification does not exist', async () => {
      const notificationId = BigInt(999);
      const userId = BigInt(10);

      mockNotificationsRepository.findById.mockResolvedValue(null);

      await expect(service.markAsSeen(notificationId, userId)).rejects.toThrow(
        new HttpException(
          {
            message: NOTIFICATIONS_ERROR_MESSAGES.NOTIFICATION_NOT_FOUND,
            code: NOTIFICATIONS_ERROR_CODES.NOTIFICATION_NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        ),
      );

      expect(mockNotificationsRepository.markAsSeen).not.toHaveBeenCalled();
    });

    it('should publish SSE event with unseen count after marking as seen', async () => {
      const notificationId = BigInt(1);
      const userId = BigInt(10);

      mockNotificationsRepository.findById.mockResolvedValue({ id: notificationId });
      mockNotificationsRepository.markAsSeen.mockResolvedValue({ count: 1 });
      mockNotificationsRepository.getUnseenCount.mockResolvedValue(4);

      await service.markAsSeen(notificationId, userId);

      expect(mockNotificationsRepository.getUnseenCount).toHaveBeenCalledWith(userId);
      expect(mockSseEventsService.publishNotificationSeen).toHaveBeenCalledWith(
        userId,
        notificationId,
        4,
      );
    });
  });
});
