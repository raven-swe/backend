import { Test, TestingModule } from '@nestjs/testing';
import { EventPublisherService } from 'src/conversations/event-publisher.service';
import { SseService } from 'src/conversations/sse.service';
import { ConversationsService } from 'src/conversations/conversations.service';

describe('EventPublisherService', () => {
  let service: EventPublisherService;

  const mockSseService = {
    publish: jest.fn(),
  };

  const mockConversationsService = {
    getConversationParticipants: jest.fn(),
    countUnseenConversations: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventPublisherService,
        {
          provide: SseService,
          useValue: mockSseService,
        },
        {
          provide: ConversationsService,
          useValue: mockConversationsService,
        },
      ],
    }).compile();

    service = module.get<EventPublisherService>(EventPublisherService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publishNewMessagePreview', () => {
    const mockMessage = {
      id: BigInt(123),
      createdAt: new Date('2024-01-15T10:00:00Z'),
      conversationId: BigInt(456),
      userId: BigInt(789),
      content:
        'Hello, this is a test message that is long enough to be truncated at 80 characters or more',
    };

    const mockSender = {
      id: '789',
      username: 'sender',
      displayName: 'Sender User',
      avatarUrl: 'https://example.com/sender-avatar.jpg',
    };

    it('should not publish if conversation has no participants', async () => {
      mockConversationsService.getConversationParticipants.mockResolvedValue(null);

      await service.publishNewMessagePreview('conv-1', mockMessage, mockSender);

      expect(mockSseService.publish).not.toHaveBeenCalled();
    });

    it('should publish new message event to all participants', async () => {
      const mockParticipants = [
        {
          user: {
            id: BigInt(1),
            username: 'user1',
            profile: {
              displayName: 'User One',
              avatarUrl: 'https://example.com/avatar1.jpg',
            },
          },
        },
        {
          user: {
            id: BigInt(2),
            username: 'user2',
            profile: {
              displayName: 'User Two',
              avatarUrl: 'https://example.com/avatar2.jpg',
            },
          },
        },
      ];

      mockConversationsService.getConversationParticipants.mockResolvedValue(mockParticipants);
      mockConversationsService.countUnseenConversations.mockResolvedValue(3);

      await service.publishNewMessagePreview('conv-1', mockMessage, mockSender);

      expect(mockSseService.publish).toHaveBeenCalledTimes(4);
    });

    it('should truncate message content to 80 characters in snippet', async () => {
      const mockParticipants = [
        {
          user: {
            id: BigInt(789),
            username: 'sender',
            profile: {
              displayName: 'Sender',
              avatarUrl: 'https://example.com/avatar.jpg',
            },
          },
        },
      ];

      mockConversationsService.getConversationParticipants.mockResolvedValue(mockParticipants);

      await service.publishNewMessagePreview('conv-1', mockMessage, mockSender);

      expect(mockSseService.publish).toHaveBeenCalled();
      const firstCall = mockSseService.publish.mock.calls[0] as [
        string,
        { event: string; data: { bodySnippet: string } },
      ];
      expect(firstCall[0]).toBe('789');
      expect(firstCall[1].event).toBe('dm.new_message');
      expect(firstCall[1].data.bodySnippet).toBe(mockMessage.content.slice(0, 80));
    });

    it('should publish correct message data structure', async () => {
      const mockParticipants = [
        {
          user: {
            id: BigInt(100),
            username: 'testuser',
            profile: {
              displayName: 'Test User',
              avatarUrl: 'https://example.com/test-avatar.jpg',
            },
          },
        },
      ];

      mockConversationsService.getConversationParticipants.mockResolvedValue(mockParticipants);

      await service.publishNewMessagePreview('conv-123', mockMessage, mockSender);

      expect(mockSseService.publish).toHaveBeenCalledWith('100', {
        event: 'dm.new_message',
        data: {
          messageId: '123',
          conversationId: 'conv-123',
          sender: {
            id: '789',
            username: 'sender',
            displayName: 'Sender User',
            avatarUrl: 'Sender User',
          },
          bodySnippet: mockMessage.content.slice(0, 80),
          createdAt: mockMessage.createdAt,
        },
      });
    });

    it('should use default profile picture when avatarUrl is null', async () => {
      const mockParticipants = [
        {
          user: {
            id: BigInt(200),
            username: 'noavatar',
            profile: {
              displayName: 'No Avatar User',
              avatarUrl: null,
            },
          },
        },
      ];

      mockConversationsService.getConversationParticipants.mockResolvedValue(mockParticipants);

      await service.publishNewMessagePreview('conv-456', mockMessage, mockSender);

      expect(mockSseService.publish).toHaveBeenCalled();
      const firstCall = mockSseService.publish.mock.calls[0] as [
        string,
        { event: string; data: { sender: { avatarUrl: string } } },
      ];
      expect(firstCall[0]).toBe('200');
      expect(firstCall[1].event).toBe('dm.new_message');
      expect(firstCall[1].data.sender.avatarUrl).toBe('Sender User');
    });

    it('should not publish unseen count to the message sender', async () => {
      const mockParticipants = [
        {
          user: {
            id: BigInt(789),
            username: 'sender',
            profile: {
              displayName: 'Sender',
              avatarUrl: 'https://example.com/avatar.jpg',
            },
          },
        },
        {
          user: {
            id: BigInt(999),
            username: 'receiver',
            profile: {
              displayName: 'Receiver',
              avatarUrl: 'https://example.com/avatar2.jpg',
            },
          },
        },
      ];

      mockConversationsService.getConversationParticipants.mockResolvedValue(mockParticipants);
      mockConversationsService.countUnseenConversations.mockResolvedValue(5);

      await service.publishNewMessagePreview('conv-1', mockMessage, mockSender);

      expect(mockSseService.publish).toHaveBeenCalledWith(
        '789',
        expect.objectContaining({
          event: 'dm.new_message',
        }),
      );
      expect(mockSseService.publish).toHaveBeenCalledWith(
        '999',
        expect.objectContaining({
          event: 'dm.new_message',
        }),
      );

      expect(mockSseService.publish).toHaveBeenCalledWith('999', {
        event: 'dm.unseen_conversations_count',
        data: {
          count: 5,
        },
      });

      expect(mockSseService.publish).not.toHaveBeenCalledWith(
        '789',
        expect.objectContaining({
          event: 'dm.unseen_conversations_count',
        }),
      );
    });

    it('should publish unseen count to receiver', async () => {
      const mockParticipants = [
        {
          user: {
            id: BigInt(300),
            username: 'receiver',
            profile: {
              displayName: 'Receiver',
              avatarUrl: 'https://example.com/receiver.jpg',
            },
          },
        },
      ];

      mockConversationsService.getConversationParticipants.mockResolvedValue(mockParticipants);
      mockConversationsService.countUnseenConversations.mockResolvedValue(7);

      await service.publishNewMessagePreview('conv-789', mockMessage, mockSender);

      expect(mockSseService.publish).toHaveBeenCalledWith('300', {
        event: 'dm.unseen_conversations_count',
        data: {
          count: 7,
        },
      });
      expect(mockConversationsService.countUnseenConversations).toHaveBeenCalledWith(BigInt(300));
    });

    it('should handle short messages without truncation', async () => {
      const shortMessage = {
        ...mockMessage,
        content: 'Short message',
      };

      const mockParticipants = [
        {
          user: {
            id: BigInt(400),
            username: 'user',
            profile: {
              displayName: 'User',
              avatarUrl: 'https://example.com/avatar.jpg',
            },
          },
        },
      ];

      mockConversationsService.getConversationParticipants.mockResolvedValue(mockParticipants);

      await service.publishNewMessagePreview('conv-1', shortMessage, mockSender);

      expect(mockSseService.publish).toHaveBeenCalled();
      const firstCall = mockSseService.publish.mock.calls[0] as [
        string,
        { event: string; data: { bodySnippet: string } },
      ];
      expect(firstCall[0]).toBe('400');
      expect(firstCall[1].event).toBe('dm.new_message');
      expect(firstCall[1].data.bodySnippet).toBe('Short message');
    });

    it('should handle empty participants array', async () => {
      mockConversationsService.getConversationParticipants.mockResolvedValue([]);

      await service.publishNewMessagePreview('conv-1', mockMessage, mockSender);

      expect(mockSseService.publish).not.toHaveBeenCalled();
      expect(mockConversationsService.countUnseenConversations).not.toHaveBeenCalled();
    });
  });
});
