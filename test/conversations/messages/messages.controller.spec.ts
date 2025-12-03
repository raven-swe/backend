/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { MessagesController } from 'src/conversations/messages/messages.controller';
import { MessagesService } from 'src/conversations/messages/messages.services';
import { JwtAuthGuard } from 'src/auth/guards';

describe('MessagesController', () => {
  let controller: MessagesController;
  let service: jest.Mocked<MessagesService>;

  const mockUser = {
    id: '6',
    username: 'layla',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        {
          provide: MessagesService,
          useValue: {
            getMessagesInConversation: jest.fn(),
            deleteConversationMessage: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MessagesController>(MessagesController);
    service = module.get(MessagesService);

    jest.clearAllMocks();
  });

  describe('getMessagesInConversation', () => {
    it('should successfully retrieve messages for a conversation', async () => {
      const mockResult = {
        items: {
          messages: [
            {
              id: '1',
              content: 'Hello',
              createdAt: new Date(),
              isMine: true,
            },
          ],
          participant: {
            username: 'tasneem',
            displayName: 'Tasneem',
            avatarUrl: 'https://example.com/avatar.jpg',
            otherParticipantLastSeenMessageId: '1',
          },
        },
        pagination: { hasNextPage: false, nextCursor: null },
      };
      service.getMessagesInConversation.mockResolvedValue(mockResult);

      const result = await controller.getMessagesInConversation(
        mockUser,
        { conversationId: '2' },
        { limit: 10, cursor: '' },
      );

      expect(service.getMessagesInConversation).toHaveBeenCalledWith(BigInt(6), BigInt(2), 10, '');
      expect(result).toEqual(mockResult);
    });

    it('should handle pagination with cursor', async () => {
      const mockResult = {
        items: {
          messages: [],
          participant: {
            username: 'user',
            displayName: 'User',
            avatarUrl: 'https://example.com/user.jpg',
            otherParticipantLastSeenMessageId: '0',
          },
        },
        pagination: { hasNextPage: false, nextCursor: null },
      };
      service.getMessagesInConversation.mockResolvedValue(mockResult);

      const cursor = 'eyJtZXNzYWdlSWQiOiI1In0=';
      await controller.getMessagesInConversation(
        mockUser,
        { conversationId: '2' },
        { limit: 20, cursor },
      );

      expect(service.getMessagesInConversation).toHaveBeenCalledWith(
        BigInt(6),
        BigInt(2),
        20,
        cursor,
      );
    });

    it('should convert IDs to BigInt', async () => {
      service.getMessagesInConversation.mockResolvedValue({
        items: {
          messages: [],
          participant: {
            username: 'user',
            displayName: 'User',
            avatarUrl: 'https://example.com/user.jpg',
            otherParticipantLastSeenMessageId: '0',
          },
        },
        pagination: { hasNextPage: false, nextCursor: null },
      });

      await controller.getMessagesInConversation(
        mockUser,
        { conversationId: '5' },
        { limit: 10, cursor: '' },
      );

      const calls = service.getMessagesInConversation.mock.calls[0];
      expect(calls[0]).toEqual(BigInt(6)); // userId
      expect(calls[1]).toEqual(BigInt(5)); // conversationId
    });

    it('should handle empty message list', async () => {
      service.getMessagesInConversation.mockResolvedValue({
        items: {
          messages: [],
          participant: {
            username: 'tasneem',
            displayName: 'Tasneem',
            avatarUrl: 'https://example.com/avatar.jpg',
            otherParticipantLastSeenMessageId: '',
          },
        },
        pagination: { hasNextPage: false, nextCursor: null },
      });

      const result = await controller.getMessagesInConversation(
        mockUser,
        { conversationId: '2' },
        { limit: 10, cursor: '' },
      );

      expect(result.items.messages).toHaveLength(0);
    });

    it('should indicate more messages available', async () => {
      service.getMessagesInConversation.mockResolvedValue({
        items: {
          messages: [
            {
              id: '1',
              content: 'Test',
              createdAt: new Date(),
              isMine: true,
            },
          ],
          participant: {
            username: 'user',
            displayName: 'User',
            avatarUrl: 'https://example.com/user.jpg',
            otherParticipantLastSeenMessageId: '0',
          },
        },
        pagination: { hasNextPage: true, nextCursor: 'next-cursor-value' },
      });

      const result = await controller.getMessagesInConversation(
        mockUser,
        { conversationId: '2' },
        { limit: 1, cursor: '' },
      );

      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.nextCursor).toBe('next-cursor-value');
    });
  });

  describe('deleteConversationMessage', () => {
    it('should successfully delete a message', async () => {
      service.deleteConversationMessage.mockResolvedValue(undefined);

      const result = await controller.deleteConversationMessage(mockUser, {
        conversationId: '2',
        messageId: '10',
      });

      expect(service.deleteConversationMessage).toHaveBeenCalledWith(
        BigInt(6),
        BigInt(2),
        BigInt(10),
      );
      expect(result).toEqual({ message: 'Message deleted successfully' });
    });

    it('should return success message after deletion', async () => {
      service.deleteConversationMessage.mockResolvedValue(undefined);

      const result = await controller.deleteConversationMessage(mockUser, {
        conversationId: '5',
        messageId: '50',
      });

      expect(result.message).toBe('Message deleted successfully');
    });

    it('should convert all IDs to BigInt', async () => {
      service.deleteConversationMessage.mockResolvedValue(undefined);

      await controller.deleteConversationMessage(mockUser, {
        conversationId: '3',
        messageId: '25',
      });

      const calls = service.deleteConversationMessage.mock.calls[0];
      expect(calls[0]).toEqual(BigInt(6)); // userId
      expect(calls[1]).toEqual(BigInt(3)); // conversationId
      expect(calls[2]).toEqual(BigInt(25)); // messageId
    });

    it('should handle deletion errors', async () => {
      service.deleteConversationMessage.mockRejectedValue(new Error('Message not found'));

      await expect(
        controller.deleteConversationMessage(mockUser, {
          conversationId: '2',
          messageId: '999',
        }),
      ).rejects.toThrow('Message not found');
    });

    it('should handle unauthorized deletion attempts', async () => {
      service.deleteConversationMessage.mockRejectedValue(
        new Error('You cannot delete this message'),
      );

      await expect(
        controller.deleteConversationMessage(mockUser, {
          conversationId: '2',
          messageId: '10',
        }),
      ).rejects.toThrow('You cannot delete this message');
    });
  });
});
