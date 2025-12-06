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
            getConversationParticipants: jest.fn(),
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
        reactionSender: null,
        reactionSenderAt: null,
        reactionReceiver: null,
        reactionReceiverAt: null,
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
        reactionSender: null,
        reactionSenderAt: null,
        reactionReceiver: null,
        reactionReceiverAt: null,
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
      expect(result.items.messages[0]).toMatchObject({
        id: '1',
        content: 'Hello!',
        createdAt: mockMessages[0].createdAt,
        isMine: false,
      });
      expect(result.items.messages[0].reactions).toBeDefined();
      expect(result.items.messages[1]).toMatchObject({
        id: '2',
        content: 'Hi there!',
        createdAt: mockMessages[1].createdAt,
        isMine: true,
      });
      expect(result.items.messages[1].reactions).toBeDefined();
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
        reactionSender: null,
        reactionSenderAt: null,
        reactionReceiver: null,
        reactionReceiverAt: null,
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

  describe('addReactionToMessage', () => {
    const userId = '6';
    const messageId = '1';
    const conversationId = '2';
    const reaction = '👍';

    const mockMessage = {
      id: BigInt(1),
      conversationId: BigInt(2),
      userId: BigInt(3),
      content: 'Hello!',
      createdAt: new Date(),
      reactionSender: null,
      reactionReceiver: null,
      reactionSenderAt: null,
      reactionReceiverAt: null,
    };

    const mockParticipants = [
      {
        userId: BigInt(3),
        user: {
          id: BigInt(3),
          username: 'tasneem',
          profile: {
            displayName: 'Tasneem',
            avatarUrl: 'https://example.com/tasneem.jpg',
          },
        },
      },
      {
        userId: BigInt(6),
        user: {
          id: BigInt(6),
          username: 'layla',
          profile: {
            displayName: 'Layla',
            avatarUrl: 'https://example.com/layla.jpg',
          },
        },
      },
    ];

    const mockReactionDb = {
      id: BigInt(1),
      reactionSender: '👍',
      reactionReceiver: null,
      reactionSenderAt: new Date(),
      reactionReceiverAt: null,
    };

    beforeEach(() => {
      messagesRepository.getMessageById = jest.fn();
      messagesRepository.addMessageReaction = jest.fn();
      conversationsRepository.getConversationParticipants = jest.fn();
    });

    it('should successfully add reaction from receiver', async () => {
      messagesRepository.getMessageById.mockResolvedValue(mockMessage as any);
      conversationsRepository.getConversationParticipants.mockResolvedValue(
        mockParticipants as any,
      );
      messagesRepository.addMessageReaction.mockResolvedValue(mockReactionDb as any);

      const result = await service.addReactionToMessage(
        userId,
        messageId,
        reaction,
        conversationId,
      );

      expect(messagesRepository.getMessageById).toHaveBeenCalledWith(BigInt(1));
      expect(conversationsRepository.getConversationParticipants).toHaveBeenCalledWith(BigInt(2));
      expect(messagesRepository.addMessageReaction).toHaveBeenCalledWith(
        BigInt(1),
        'receiver',
        reaction,
      );
      expect(result).toEqual({
        reactionDb: mockReactionDb,
        sender: mockParticipants[0],
        receiver: mockParticipants[1],
      });
    });

    it('should successfully add reaction from sender (message author)', async () => {
      const authorMessage = { ...mockMessage, userId: BigInt(6) };
      messagesRepository.getMessageById.mockResolvedValue(authorMessage as any);
      conversationsRepository.getConversationParticipants.mockResolvedValue(
        mockParticipants as any,
      );
      messagesRepository.addMessageReaction.mockResolvedValue(mockReactionDb as any);

      await service.addReactionToMessage(userId, messageId, reaction, conversationId);

      expect(messagesRepository.addMessageReaction).toHaveBeenCalledWith(
        BigInt(1),
        'sender',
        reaction,
      );
    });

    it('should toggle reaction when same reaction is sent (remove)', async () => {
      const messageWithReaction = { ...mockMessage, reactionReceiver: '👍' };
      messagesRepository.getMessageById.mockResolvedValue(messageWithReaction as any);
      conversationsRepository.getConversationParticipants.mockResolvedValue(
        mockParticipants as any,
      );
      messagesRepository.addMessageReaction.mockResolvedValue(mockReactionDb as any);

      await service.addReactionToMessage(userId, messageId, '👍', conversationId);

      expect(messagesRepository.addMessageReaction).toHaveBeenCalledWith(
        BigInt(1),
        'receiver',
        null,
      );
    });

    it('should return error when userId is invalid', async () => {
      const result = await service.addReactionToMessage(
        'invalid',
        messageId,
        reaction,
        conversationId,
      );

      expect(result).toEqual({ error: 'INVALID_ID' });
      expect(messagesRepository.getMessageById).not.toHaveBeenCalled();
    });

    it('should return error when messageId is invalid', async () => {
      const result = await service.addReactionToMessage(
        userId,
        'invalid',
        reaction,
        conversationId,
      );

      expect(result).toEqual({ error: 'INVALID_ID' });
      expect(messagesRepository.getMessageById).not.toHaveBeenCalled();
    });

    it('should return error when conversationId is invalid', async () => {
      const result = await service.addReactionToMessage(userId, messageId, reaction, 'invalid');

      expect(result).toEqual({ error: 'INVALID_ID' });
      expect(messagesRepository.getMessageById).not.toHaveBeenCalled();
    });

    it('should return error when message does not exist', async () => {
      messagesRepository.getMessageById.mockResolvedValue(null);

      const result = await service.addReactionToMessage(
        userId,
        messageId,
        reaction,
        conversationId,
      );

      expect(result).toEqual({ error: 'INVALID_ID' });
      expect(conversationsRepository.getConversationParticipants).not.toHaveBeenCalled();
    });

    it('should return error when message belongs to different conversation', async () => {
      const wrongConversationMessage = { ...mockMessage, conversationId: BigInt(999) };
      messagesRepository.getMessageById.mockResolvedValue(wrongConversationMessage as any);

      const result = await service.addReactionToMessage(
        userId,
        messageId,
        reaction,
        conversationId,
      );

      expect(result).toEqual({ error: 'INVALID_ID' });
      expect(conversationsRepository.getConversationParticipants).not.toHaveBeenCalled();
    });

    it('should return error when database operation fails', async () => {
      messagesRepository.getMessageById.mockResolvedValue(mockMessage as any);
      conversationsRepository.getConversationParticipants.mockResolvedValue(
        mockParticipants as any,
      );
      messagesRepository.addMessageReaction.mockResolvedValue(null as never);

      const result = await service.addReactionToMessage(
        userId,
        messageId,
        reaction,
        conversationId,
      );

      expect(result).toEqual({ error: 'REACTION_CREATION_FAILED' });
    });

    it('should find correct sender and receiver from participants', async () => {
      messagesRepository.getMessageById.mockResolvedValue(mockMessage as any);
      conversationsRepository.getConversationParticipants.mockResolvedValue(
        mockParticipants as any,
      );
      messagesRepository.addMessageReaction.mockResolvedValue(mockReactionDb as any);

      const result = await service.addReactionToMessage(
        userId,
        messageId,
        reaction,
        conversationId,
      );

      expect(result).toHaveProperty('sender');
      expect(result).toHaveProperty('receiver');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((result as any).sender.user.id).toBe(BigInt(3));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((result as any).receiver.user.id).toBe(BigInt(6));
    });

    it('should handle different emoji reactions', async () => {
      messagesRepository.getMessageById.mockResolvedValue(mockMessage as any);
      conversationsRepository.getConversationParticipants.mockResolvedValue(
        mockParticipants as any,
      );
      messagesRepository.addMessageReaction.mockResolvedValue(mockReactionDb as any);

      await service.addReactionToMessage(userId, messageId, '❤️', conversationId);

      expect(messagesRepository.addMessageReaction).toHaveBeenCalledWith(
        BigInt(1),
        'receiver',
        '❤️',
      );
    });
  });
});
