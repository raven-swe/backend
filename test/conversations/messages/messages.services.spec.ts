/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { MessagesService } from 'src/conversations/messages/messages.services';
import { ConversationsRepository } from 'src/conversations/conversations.repository';
import { MessagesRepository } from 'src/conversations/messages/messages.repository';
import { VALIDATION_ERROR_CODES } from 'src/common/constants';
import {
  CONVERSATIONS_ERROR_CODES,
  CONVERSATIONS_ERROR_MESSAGES,
} from 'src/conversations/constants/conversation-constants';

describe('MessagesService', () => {
  let service: MessagesService;
  let conversationsRepository: jest.Mocked<ConversationsRepository>;
  let messagesRepository: jest.Mocked<MessagesRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: ConversationsRepository,
          useValue: {
            getConversation: jest.fn(),
          },
        },
        {
          provide: MessagesRepository,
          useValue: {
            getMessages: jest.fn(),
            updateLastSeenMessage: jest.fn(),
            createMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    conversationsRepository = module.get(ConversationsRepository);
    messagesRepository = module.get(MessagesRepository);

    jest.clearAllMocks();
  });

  describe('getMessagesInConversation', () => {
    const userId = BigInt(6);
    const conversationId = BigInt(2);
    const limit = 10;

    const mockConversation = {
      conversationParticipants: [
        {
          userId: BigInt(6),
          user: {
            username: 'layla',
            profile: {
              displayName: 'Layla',
              avatarUrl: 'https://example.com/layla.jpg',
            },
          },
        },
        {
          userId: BigInt(3),
          user: {
            username: 'tasneem',
            profile: {
              displayName: 'Tasneem',
              avatarUrl: 'https://example.com/tasneem.jpg',
            },
          },
        },
      ],
    };

    const mockMessages = [
      {
        id: BigInt(1),
        conversationId: conversationId,
        userId: BigInt(3),
        content: 'Hello!',
        messageEntities: null,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        mediaUrl: null,
        isDeletedSender: false,
        isDeletedReceiver: false,
      },
      {
        id: BigInt(2),
        conversationId: conversationId,
        userId: BigInt(6),
        content: 'Hi there!',
        messageEntities: null,
        createdAt: new Date('2024-01-01T10:01:00Z'),
        mediaUrl: null,
        isDeletedSender: false,
        isDeletedReceiver: false,
      },
    ];

    it('should successfully retrieve messages for a valid conversation', async () => {
      conversationsRepository.getConversation.mockResolvedValue(mockConversation as any);
      messagesRepository.getMessages.mockResolvedValue(mockMessages);

      const result = await service.getMessagesInConversation(userId, conversationId, limit, '');

      expect(conversationsRepository.getConversation).toHaveBeenCalledWith(conversationId);
      expect(messagesRepository.getMessages).toHaveBeenCalledWith(
        userId,
        conversationId,
        limit + 1,
        undefined,
      );
      expect(result.items.participant).toEqual({
        username: 'tasneem',
        displayName: 'Tasneem',
        avatarUrl: 'https://example.com/tasneem.jpg',
      });
      expect(result.items.messages).toHaveLength(2);
      expect(result.items.messages[0]).toEqual({
        id: '1',
        content: 'Hello!',
        createdAt: mockMessages[0].createdAt,
        isMine: false,
      });
      expect(result.items.messages[1]).toEqual({
        id: '2',
        content: 'Hi there!',
        createdAt: mockMessages[1].createdAt,
        isMine: true,
      });
    });

    it('should handle participant with no display name', async () => {
      const conversationWithoutProfile = {
        ...mockConversation,
        conversationParticipants: [
          mockConversation.conversationParticipants[0],
          {
            ...mockConversation.conversationParticipants[1],
            user: {
              ...mockConversation.conversationParticipants[1].user,
              profile: null,
            },
          },
        ],
      };

      conversationsRepository.getConversation.mockResolvedValue(conversationWithoutProfile as any);
      messagesRepository.getMessages.mockResolvedValue(mockMessages);

      const result = await service.getMessagesInConversation(userId, conversationId, limit, '');

      expect(result.items.participant).toEqual({
        username: 'tasneem',
        displayName: '',
      });
    });

    it('should handle cursor-based pagination', async () => {
      const cursor = Buffer.from(
        JSON.stringify({ messageId: '5', createdAt: '2024-01-01T00:00:00.000Z' }),
      ).toString('base64');

      conversationsRepository.getConversation.mockResolvedValue(mockConversation as any);
      messagesRepository.getMessages.mockResolvedValue([mockMessages[0]]);

      const result = await service.getMessagesInConversation(userId, conversationId, limit, cursor);

      expect(messagesRepository.getMessages).toHaveBeenCalledWith(
        userId,
        conversationId,
        limit + 1,
        {
          messageId: '5',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      );
      expect(result.items.messages).toHaveLength(1);
    });

    it('should throw error when conversation does not exist', async () => {
      conversationsRepository.getConversation.mockResolvedValue(null);

      await expect(
        service.getMessagesInConversation(userId, conversationId, limit, ''),
      ).rejects.toThrow(
        new HttpException(
          {
            message: CONVERSATIONS_ERROR_MESSAGES.INVALID_CONVERSATION_ID,
            code: CONVERSATIONS_ERROR_CODES.INVALID_CONVERSATION_ID,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw error when conversation has no participants', async () => {
      conversationsRepository.getConversation.mockResolvedValue({
        ...mockConversation,
        conversationParticipants: null,
      } as any);

      await expect(
        service.getMessagesInConversation(userId, conversationId, limit, ''),
      ).rejects.toThrow(
        new HttpException(
          {
            message: CONVERSATIONS_ERROR_MESSAGES.INVALID_CONVERSATION_ID,
            code: CONVERSATIONS_ERROR_CODES.INVALID_CONVERSATION_ID,
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw error when user is not a participant', async () => {
      const nonParticipantUserId = BigInt(999);

      conversationsRepository.getConversation.mockResolvedValue(mockConversation as any);

      await expect(
        service.getMessagesInConversation(nonParticipantUserId, conversationId, limit, ''),
      ).rejects.toThrow(
        new HttpException(
          {
            message: CONVERSATIONS_ERROR_MESSAGES.FORBIDDEN_CONVERSATION_ID,
            code: CONVERSATIONS_ERROR_CODES.FORBIDDEN_CONVERSATION_ID,
          },
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('should throw error for invalid cursor format', async () => {
      const invalidCursor = 'invalid-cursor';

      conversationsRepository.getConversation.mockResolvedValue(mockConversation as any);

      await expect(
        service.getMessagesInConversation(userId, conversationId, limit, invalidCursor),
      ).rejects.toThrow(
        new HttpException(
          { message: 'Invalid cursor format', code: VALIDATION_ERROR_CODES.INVALID_FORMAT },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should handle pagination correctly with more messages than limit', async () => {
      const manyMessages = Array.from({ length: 11 }, (_, i) => ({
        id: BigInt(i + 1),
        conversationId: conversationId,
        userId: BigInt(i % 2 === 0 ? 3 : 6),
        content: `Message ${i + 1}`,
        messageEntities: null,
        createdAt: new Date(`2024-01-01T10:${i.toString().padStart(2, '0')}:00Z`),
        mediaUrl: null,
        isDeletedSender: false,
        isDeletedReceiver: false,
      }));

      conversationsRepository.getConversation.mockResolvedValue(mockConversation as any);
      messagesRepository.getMessages.mockResolvedValue(manyMessages);

      const result = await service.getMessagesInConversation(userId, conversationId, limit, '');

      expect(result.pagination.nextCursor).toBeDefined();
      expect(result.items.messages).toHaveLength(10);
    });
  });

  describe('updateLastSeen', () => {
    it('should successfully update last seen message', async () => {
      const mockUpdatedParticipant = {
        lastSeenMessageId: BigInt(12),
        unseenCount: 0,
        latestMessageUsername: 'layla',
      };

      messagesRepository.updateLastSeenMessage.mockResolvedValue(mockUpdatedParticipant as any);

      const result = await service.updateLastSeen('6', '2', '12');

      expect(messagesRepository.updateLastSeenMessage).toHaveBeenCalledWith(
        BigInt(2),
        BigInt(6),
        BigInt(12),
      );
      expect(result).toEqual({
        lastSeenMessageId: '12',
        seenAt: expect.any(Date),
        unseenCount: 0,
        username: 'layla',
      });
    });

    it('should handle null lastSeenMessageId', async () => {
      const mockUpdatedParticipant = {
        lastSeenMessageId: null,
        unseenCount: 5,
        latestMessageUsername: 'tasneem',
      };

      messagesRepository.updateLastSeenMessage.mockResolvedValue(mockUpdatedParticipant as any);

      const result = await service.updateLastSeen('6', '2', '12');

      expect(result).toEqual({
        lastSeenMessageId: null,
        seenAt: expect.any(Date),
        unseenCount: 5,
        username: 'tasneem',
      });
    });

    it('should return error for invalid user ID', async () => {
      const result = await service.updateLastSeen('invalid', '2', '12');

      expect(result).toEqual({ error: 'INVALID_ID' });
      expect(messagesRepository.updateLastSeenMessage).not.toHaveBeenCalled();
    });

    it('should return error for invalid conversation ID', async () => {
      const result = await service.updateLastSeen('6', 'invalid', '12');

      expect(result).toEqual({ error: 'INVALID_ID' });
      expect(messagesRepository.updateLastSeenMessage).not.toHaveBeenCalled();
    });

    it('should return error for invalid message ID', async () => {
      const result = await service.updateLastSeen('6', '2', 'invalid');

      expect(result).toEqual({ error: 'INVALID_ID' });
      expect(messagesRepository.updateLastSeenMessage).not.toHaveBeenCalled();
    });

    it('should return error when update fails', async () => {
      messagesRepository.updateLastSeenMessage.mockResolvedValue(null as any);

      const result = await service.updateLastSeen('6', '2', '12');

      expect(result).toEqual({ error: 'UPDATE_FAILED' });
    });

    it('should handle large BigInt values', async () => {
      const mockUpdatedParticipant = {
        lastSeenMessageId: BigInt('999999999999999999'),
        unseenCount: 0,
        latestMessageUsername: 'layla',
      };

      messagesRepository.updateLastSeenMessage.mockResolvedValue(mockUpdatedParticipant as any);

      const result = await service.updateLastSeen('6', '2', '999999999999999999');

      expect(result.lastSeenMessageId).toBe('999999999999999999');
    });
  });

  describe('createMessage', () => {
    const mockMessage = {
      id: BigInt(42),
      conversationId: BigInt(2),
      userId: BigInt(6),
      content: 'Hello world!',
      messageEntities: null,
      createdAt: new Date('2024-01-01T10:00:00Z'),
      mediaUrl: null,
      isDeletedSender: false,
      isDeletedReceiver: false,
      reactionSender: null,
      reactionSenderAt: null,
      reactionReceiver: null,
      reactionReceiverAt: null,
    };

    it('should successfully create a message', async () => {
      messagesRepository.createMessage.mockResolvedValue(mockMessage);
      messagesRepository.updateLastSeenMessage.mockResolvedValue({} as any);

      const result = await service.createMessage('2', '6', 'Hello world!');

      expect(messagesRepository.createMessage).toHaveBeenCalledWith(
        BigInt(2),
        BigInt(6),
        'Hello world!',
      );
      expect(messagesRepository.updateLastSeenMessage).toHaveBeenCalledWith(
        BigInt(2),
        BigInt(6),
        BigInt(42),
      );
      expect(result).toEqual({ message: mockMessage });
    });

    it('should create message with empty body', async () => {
      const emptyMessage = { ...mockMessage, content: '' };
      messagesRepository.createMessage.mockResolvedValue(emptyMessage);
      messagesRepository.updateLastSeenMessage.mockResolvedValue({} as any);

      const result = await service.createMessage('2', '6', '');

      expect(messagesRepository.createMessage).toHaveBeenCalledWith(BigInt(2), BigInt(6), '');
      expect(result).toEqual({ message: emptyMessage });
    });

    it('should return error for invalid conversation ID', async () => {
      const result = await service.createMessage('invalid', '6', 'Hello');

      expect(result).toEqual({ error: 'INVALID_CONVERSATION_ID' });
      expect(messagesRepository.createMessage).not.toHaveBeenCalled();
      expect(messagesRepository.updateLastSeenMessage).not.toHaveBeenCalled();
    });

    it('should return error for invalid sender ID', async () => {
      const result = await service.createMessage('2', 'invalid', 'Hello');

      expect(result).toEqual({ error: 'INVALID_CONVERSATION_ID' });
      expect(messagesRepository.createMessage).not.toHaveBeenCalled();
      expect(messagesRepository.updateLastSeenMessage).not.toHaveBeenCalled();
    });

    it('should return error when message creation fails', async () => {
      messagesRepository.createMessage.mockResolvedValue(null as any);

      const result = await service.createMessage('2', '6', 'Hello');

      expect(result).toEqual({ error: 'MESSAGE_CREATION_FAILED' });
      expect(messagesRepository.updateLastSeenMessage).not.toHaveBeenCalled();
    });

    it('should update last seen after message creation', async () => {
      messagesRepository.createMessage.mockResolvedValue(mockMessage);
      messagesRepository.updateLastSeenMessage.mockResolvedValue({
        lastSeenMessageId: BigInt(42),
        unseenCount: 0,
        latestMessageUsername: 'layla',
      } as any);

      await service.createMessage('2', '6', 'Hello');

      expect(messagesRepository.updateLastSeenMessage).toHaveBeenCalledTimes(1);
      expect(messagesRepository.updateLastSeenMessage).toHaveBeenCalledWith(
        BigInt(2),
        BigInt(6),
        BigInt(42),
      );
    });

    it('should handle very long message body', async () => {
      const longBody = 'a'.repeat(10000);
      const longMessage = { ...mockMessage, content: longBody };
      messagesRepository.createMessage.mockResolvedValue(longMessage);
      messagesRepository.updateLastSeenMessage.mockResolvedValue({} as any);

      const result = await service.createMessage('2', '6', longBody);

      expect(messagesRepository.createMessage).toHaveBeenCalledWith(BigInt(2), BigInt(6), longBody);
      expect(result).toEqual({ message: longMessage });
    });

    it('should handle message with special characters', async () => {
      const specialBody = '😀 Hello! @user #hashtag https://example.com';
      const specialMessage = { ...mockMessage, content: specialBody };
      messagesRepository.createMessage.mockResolvedValue(specialMessage);
      messagesRepository.updateLastSeenMessage.mockResolvedValue({} as any);

      const result = await service.createMessage('2', '6', specialBody);

      expect(result).toEqual({ message: specialMessage });
    });
  });
});
