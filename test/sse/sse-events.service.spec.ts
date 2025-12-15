/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { SseEventsService, SSE_EVENTS, NewMessagePayload } from '../../src/sse/sse-events.service';
import { EventPublisherService } from '../../src/sse/event-publisher.service';
import { NotificationResponseDto } from '../../src/notifications/dtos/notification-response.dto';
import { NotificationType } from '@prisma/client';

describe('SseEventsService', () => {
  let service: SseEventsService;
  let publisherMock: jest.Mocked<EventPublisherService>;

  beforeEach(async () => {
    publisherMock = {
      publishToUser: jest.fn().mockResolvedValue(undefined),
      publishToUsers: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EventPublisherService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [SseEventsService, { provide: EventPublisherService, useValue: publisherMock }],
    }).compile();

    service = module.get<SseEventsService>(SseEventsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
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
    });
  });
});
