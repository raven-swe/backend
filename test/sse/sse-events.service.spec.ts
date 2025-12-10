/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { SseEventsService, SSE_EVENTS, NewMessagePayload } from '../../src/sse/sse-events.service';
import { EventPublisherService } from '../../src/sse/event-publisher.service';

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

  describe('SSE_EVENTS constants', () => {
    it('should have correct event names', () => {
      expect(SSE_EVENTS.DM_UNSEEN_COUNT).toBe('dm.unseen_conversations_count');
      expect(SSE_EVENTS.DM_NEW_MESSAGE).toBe('dm.new_message');
    });
  });
});
