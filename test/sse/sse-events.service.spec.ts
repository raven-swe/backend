/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { SseEventsService, SSE_EVENTS, NewMessagePayload } from '../../src/sse/sse-events.service';
import { EventPublisherService } from '../../src/sse/event-publisher.service';
import { NotificationResponseDto } from '../../src/notifications/dtos/notification-response.dto';
import { NotificationType } from '@prisma/client';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaUrlService } from '../../src/common/media-url';

const CDN_URL = 'https://cdn.example.com';

describe('SseEventsService', () => {
  let service: SseEventsService;
  let publisherMock: jest.Mocked<EventPublisherService>;

  beforeEach(async () => {
    // Suppress logger output
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();

    publisherMock = {
      publishToUser: jest.fn().mockResolvedValue(undefined),
      publishToUsers: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EventPublisherService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SseEventsService,
        { provide: EventPublisherService, useValue: publisherMock },
        MediaUrlService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => (key === 'CDN_URL' ? CDN_URL : undefined) },
        },
      ],
    }).compile();

    service = module.get<SseEventsService>(SseEventsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publishUnseenCount', () => {
    it('should publish unseen count to user with correct event name', async () => {
      const userId = BigInt(123);
      const count = 5;

      await service.publishUnseenCount(userId, count);

      expect(publisherMock.publishToUser).toHaveBeenCalledWith('123', {
        event: SSE_EVENTS.DM_UNSEEN_COUNT,
        data: { count: 5 },
      });
    });

    it('should handle zero unseen count', async () => {
      const userId = BigInt(456);
      const count = 0;

      await service.publishUnseenCount(userId, count);

      expect(publisherMock.publishToUser).toHaveBeenCalledWith('456', {
        event: SSE_EVENTS.DM_UNSEEN_COUNT,
        data: { count: 0 },
      });
    });
  });

  describe('publishNewMessagePreview', () => {
    const mockPayload: NewMessagePayload = {
      messageId: '999',
      conversationId: 'conv-123',
      sender: {
        id: '100',
        username: 'testuser',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
      },
      bodySnippet: 'Hello, this is a test message',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      hasMedia: false,
    };

    it('should publish new message preview to user with correct event name', async () => {
      const userId = BigInt(123);

      await service.publishNewMessagePreview(userId, mockPayload);

      expect(publisherMock.publishToUser).toHaveBeenCalledWith('123', {
        event: SSE_EVENTS.DM_NEW_MESSAGE,
        data: mockPayload,
      });
    });

    it('should handle null avatar URL', async () => {
      const userId = BigInt(123);
      const payloadWithNullAvatar: NewMessagePayload = {
        ...mockPayload,
        sender: { ...mockPayload.sender, avatarUrl: null },
      };

      await service.publishNewMessagePreview(userId, payloadWithNullAvatar);

      expect(publisherMock.publishToUser).toHaveBeenCalledWith('123', {
        event: SSE_EVENTS.DM_NEW_MESSAGE,
        data: payloadWithNullAvatar,
      });
    });
  });

  describe('publishNewNotification', () => {
    it('should publish new notification and count update', async () => {
      const receiverId = BigInt(789);
      const notification: NotificationResponseDto = {
        id: '1',
        type: NotificationType.LIKE,
        actorSummary: { previewActors: [], totalCount: 1 },
        tweetSummary: { primaryTweet: null, totalCount: 0, subjectIds: [] },
        latestEventAt: new Date('2024-01-01T00:00:00Z'),
        isSeen: false,
      };
      const updatedCount = 10;

      await service.publishNewNotification(receiverId, notification, updatedCount);

      expect(publisherMock.publishToUser).toHaveBeenCalledTimes(2);
      expect(publisherMock.publishToUser).toHaveBeenNthCalledWith(1, '789', {
        event: 'notifications.new',
        data: notification,
      });
      expect(publisherMock.publishToUser).toHaveBeenNthCalledWith(2, '789', {
        event: 'notifications.count_update',
        data: { count: 10 },
      });
    });

    it('should handle zero notification count', async () => {
      const receiverId = BigInt(111);
      const notification: NotificationResponseDto = {
        id: '2',
        type: NotificationType.FOLLOW,
        actorSummary: { previewActors: [], totalCount: 1 },
        tweetSummary: { primaryTweet: null, totalCount: 0, subjectIds: [] },
        latestEventAt: new Date('2024-01-01T00:00:00Z'),
        isSeen: false,
      };
      const updatedCount = 0;

      await service.publishNewNotification(receiverId, notification, updatedCount);

      expect(publisherMock.publishToUser).toHaveBeenNthCalledWith(2, '111', {
        event: 'notifications.count_update',
        data: { count: 0 },
      });
    });
  });

  describe('publishNotificationSeen', () => {
    it('should publish single notification seen event', async () => {
      const receiverId = BigInt(222);
      const notificationId = BigInt(333);
      const unSeenCount = 5;

      await service.publishNotificationSeen(receiverId, notificationId, unSeenCount);

      expect(publisherMock.publishToUser).toHaveBeenCalledWith('222', {
        event: 'notifications.seen',
        data: {
          notificationId: '333',
          scope: 'SINGLE',
          unSeenCount: 5,
        },
      });
    });

    it('should publish all notifications seen when no notificationId provided', async () => {
      const receiverId = BigInt(444);
      const unSeenCount = 0;

      await service.publishNotificationSeen(receiverId, undefined, unSeenCount);

      expect(publisherMock.publishToUser).toHaveBeenCalledWith('444', {
        event: 'notifications.seen',
        data: {
          notificationId: null,
          scope: 'ALL',
          unSeenCount: 0,
        },
      });
    });

    it('should default unSeenCount to 0 when not provided', async () => {
      const receiverId = BigInt(555);
      const notificationId = BigInt(666);

      await service.publishNotificationSeen(receiverId, notificationId);

      expect(publisherMock.publishToUser).toHaveBeenCalledWith('555', {
        event: 'notifications.seen',
        data: {
          notificationId: '666',
          scope: 'SINGLE',
          unSeenCount: 0,
        },
      });
    });

    it('should handle marking all as seen without count', async () => {
      const receiverId = BigInt(777);

      await service.publishNotificationSeen(receiverId);

      expect(publisherMock.publishToUser).toHaveBeenCalledWith('777', {
        event: 'notifications.seen',
        data: {
          notificationId: null,
          scope: 'ALL',
          unSeenCount: 0,
        },
      });
    });
  });

  describe('publishUnseenNotificationCount', () => {
    it('should publish unseen notification count to user', async () => {
      const userId = BigInt(888);
      const count = 20;

      await service.publishUnseenNotificationCount(userId, count);

      expect(publisherMock.publishToUser).toHaveBeenCalledWith('888', {
        event: 'notifications.count_update',
        data: { count: 20 },
      });
    });

    it('should handle zero unseen notification count', async () => {
      const userId = BigInt(999);
      const count = 0;

      await service.publishUnseenNotificationCount(userId, count);

      expect(publisherMock.publishToUser).toHaveBeenCalledWith('999', {
        event: 'notifications.count_update',
        data: { count: 0 },
      });
    });
  });

  describe('SSE_EVENTS constants', () => {
    it('should have correct event names', () => {
      expect(SSE_EVENTS.DM_UNSEEN_COUNT).toBe('dm.unseen_conversations_count');
      expect(SSE_EVENTS.DM_NEW_MESSAGE).toBe('dm.new_message');
      expect(SSE_EVENTS.TIMELINE_FOLLOWING).toBe('timeline.following');
    });
  });

  describe('publishTimelineFollowingTweets', () => {
    it('should publish timeline following tweets with the authors avatars expanded', async () => {
      const userId = BigInt(1001);
      const authors = ['avatars/one.png', 'avatars/two.png', 'avatars/three.png'];

      await service.publishTimelineFollowingTweets(userId, authors);

      expect(publisherMock.publishToUser).toHaveBeenCalledWith('1001', {
        event: SSE_EVENTS.TIMELINE_FOLLOWING,
        data: {
          authors: [
            `${CDN_URL}/avatars/one.png`,
            `${CDN_URL}/avatars/two.png`,
            `${CDN_URL}/avatars/three.png`,
          ],
        },
      });
    });

    it('should leave author avatars that are already absolute untouched', async () => {
      const userId = BigInt(1001);
      const authors = ['https://avatars.githubusercontent.com/u/1.png'];

      await service.publishTimelineFollowingTweets(userId, authors);

      expect(publisherMock.publishToUser).toHaveBeenCalledWith('1001', {
        event: SSE_EVENTS.TIMELINE_FOLLOWING,
        data: { authors: ['https://avatars.githubusercontent.com/u/1.png'] },
      });
    });

    it('should handle null authors list', async () => {
      const userId = BigInt(1002);

      await service.publishTimelineFollowingTweets(userId, null);

      expect(publisherMock.publishToUser).toHaveBeenCalledWith('1002', {
        event: SSE_EVENTS.TIMELINE_FOLLOWING,
        data: { authors: null },
      });
    });

    it('should handle empty authors list', async () => {
      const userId = BigInt(1003);
      const authors: string[] = [];

      await service.publishTimelineFollowingTweets(userId, authors);

      expect(publisherMock.publishToUser).toHaveBeenCalledWith('1003', {
        event: SSE_EVENTS.TIMELINE_FOLLOWING,
        data: { authors: [] },
      });
    });

    it('should handle large bigint userId', async () => {
      const userId = BigInt('9007199254740991'); // Max safe integer
      const authors = ['avatars/one.png'];

      await service.publishTimelineFollowingTweets(userId, authors);

      expect(publisherMock.publishToUser).toHaveBeenCalledWith('9007199254740991', {
        event: SSE_EVENTS.TIMELINE_FOLLOWING,
        data: { authors: [`${CDN_URL}/avatars/one.png`] },
      });
    });
  });

  describe('publishNotificationDeleted', () => {
    it('should publish notification deleted event and count update', async () => {
      const receiverId = BigInt(2001);
      const updatedCount = 15;

      await service.publishNotificationDeleted(receiverId, updatedCount);

      expect(publisherMock.publishToUser).toHaveBeenCalledTimes(2);
      expect(publisherMock.publishToUser).toHaveBeenNthCalledWith(1, '2001', {
        event: 'notifications.delete',
        data: {},
      });
      expect(publisherMock.publishToUser).toHaveBeenNthCalledWith(2, '2001', {
        event: 'notifications.count_update',
        data: { count: 15 },
      });
    });

    it('should handle zero count after deletion', async () => {
      const receiverId = BigInt(2002);
      const updatedCount = 0;

      await service.publishNotificationDeleted(receiverId, updatedCount);

      expect(publisherMock.publishToUser).toHaveBeenNthCalledWith(2, '2002', {
        event: 'notifications.count_update',
        data: { count: 0 },
      });
    });

    it('should publish delete event with empty data object', async () => {
      const receiverId = BigInt(2003);
      const updatedCount = 10;

      await service.publishNotificationDeleted(receiverId, updatedCount);

      expect(publisherMock.publishToUser).toHaveBeenNthCalledWith(1, '2003', {
        event: 'notifications.delete',
        data: {},
      });
    });
  });

  describe('publishNotificationUpdate', () => {
    it('should publish notification update and count update', async () => {
      const receiverId = BigInt(3001);
      const notification: NotificationResponseDto = {
        id: '100',
        type: NotificationType.RETWEET,
        actorSummary: { previewActors: [], totalCount: 2 },
        tweetSummary: { primaryTweet: null, totalCount: 1, subjectIds: [] },
        latestEventAt: new Date('2024-01-01T12:00:00Z'),
        isSeen: true,
      };
      const updatedCount = 8;

      await service.publishNotificationUpdate(receiverId, notification, updatedCount);

      expect(publisherMock.publishToUser).toHaveBeenCalledTimes(2);
      expect(publisherMock.publishToUser).toHaveBeenNthCalledWith(1, '3001', {
        event: 'notifications.update',
        data: notification,
      });
      expect(publisherMock.publishToUser).toHaveBeenNthCalledWith(2, '3001', {
        event: 'notifications.count_update',
        data: { count: 8 },
      });
    });

    it('should handle notification update with zero count', async () => {
      const receiverId = BigInt(3002);
      const notification: NotificationResponseDto = {
        id: '101',
        type: NotificationType.MENTION,
        actorSummary: { previewActors: [], totalCount: 1 },
        tweetSummary: { primaryTweet: null, totalCount: 0, subjectIds: [] },
        latestEventAt: new Date('2024-01-02T00:00:00Z'),
        isSeen: false,
      };
      const updatedCount = 0;

      await service.publishNotificationUpdate(receiverId, notification, updatedCount);

      expect(publisherMock.publishToUser).toHaveBeenNthCalledWith(2, '3002', {
        event: 'notifications.count_update',
        data: { count: 0 },
      });
    });

    it('should handle notification update with different notification types', async () => {
      const receiverId = BigInt(3003);
      const notification: NotificationResponseDto = {
        id: '102',
        type: NotificationType.REPLY,
        actorSummary: { previewActors: [], totalCount: 1 },
        tweetSummary: { primaryTweet: null, totalCount: 1, subjectIds: [] },
        latestEventAt: new Date('2024-01-03T00:00:00Z'),
        isSeen: false,
      };
      const updatedCount = 12;

      await service.publishNotificationUpdate(receiverId, notification, updatedCount);

      expect(publisherMock.publishToUser).toHaveBeenCalledWith('3003', {
        event: 'notifications.update',
        data: notification,
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle publisher errors gracefully in publishUnseenCount', async () => {
      publisherMock.publishToUser.mockRejectedValueOnce(new Error('Publisher error'));

      await expect(service.publishUnseenCount(BigInt(999), 5)).rejects.toThrow('Publisher error');
    });

    it('should handle publisher errors gracefully in publishNewMessagePreview', async () => {
      const mockPayload: NewMessagePayload = {
        messageId: '1',
        conversationId: 'conv-1',
        sender: {
          id: '1',
          username: 'user',
          displayName: 'User',
          avatarUrl: null,
        },
        bodySnippet: 'test',
        createdAt: new Date(),
        hasMedia: false,
      };

      publisherMock.publishToUser.mockRejectedValueOnce(new Error('Publisher error'));

      await expect(service.publishNewMessagePreview(BigInt(999), mockPayload)).rejects.toThrow(
        'Publisher error',
      );
    });

    it('should convert bigint userId to string correctly for all methods', async () => {
      const userId = BigInt('123456789012345678');

      await service.publishUnseenCount(userId, 1);

      expect(publisherMock.publishToUser).toHaveBeenCalledWith(
        '123456789012345678',
        expect.any(Object),
      );
    });

    it('should handle message preview with hasMedia=true', async () => {
      const userId = BigInt(4001);
      const mockPayload: NewMessagePayload = {
        messageId: '200',
        conversationId: 'conv-200',
        sender: {
          id: '50',
          username: 'mediauser',
          displayName: 'Media User',
          avatarUrl: 'https://example.com/media.jpg',
        },
        bodySnippet: 'Check out this image!',
        createdAt: new Date('2024-01-04T00:00:00Z'),
        hasMedia: true,
      };

      await service.publishNewMessagePreview(userId, mockPayload);

      expect(publisherMock.publishToUser).toHaveBeenCalledWith('4001', {
        event: SSE_EVENTS.DM_NEW_MESSAGE,
        data: mockPayload,
      });
    });

    it('should handle notification with seen status', async () => {
      const receiverId = BigInt(5001);
      const notification: NotificationResponseDto = {
        id: '300',
        type: NotificationType.LIKE,
        actorSummary: { previewActors: [], totalCount: 5 },
        tweetSummary: { primaryTweet: null, totalCount: 1, subjectIds: [] },
        latestEventAt: new Date('2024-01-05T00:00:00Z'),
        isSeen: true,
      };
      const updatedCount = 3;

      await service.publishNewNotification(receiverId, notification, updatedCount);

      expect(publisherMock.publishToUser).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple rapid publishes without interference', async () => {
      const userId1 = BigInt(6001);
      const userId2 = BigInt(6002);

      await Promise.all([
        service.publishUnseenCount(userId1, 5),
        service.publishUnseenCount(userId2, 10),
        service.publishUnseenNotificationCount(userId1, 3),
      ]);

      expect(publisherMock.publishToUser).toHaveBeenCalledTimes(3);
    });
  });
});
