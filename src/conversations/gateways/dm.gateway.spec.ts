/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { DmGateway } from './dm.gateway';
import { ConversationsService } from '../conversations.service';
import { MessagesService } from '../messages/messages.services';
import { EventPublisherService } from '../event-publisher.service';
import { Server, Socket } from 'socket.io';
import { WsUser } from 'src/auth/interfaces/ws-user.interface';
import {
  CONVERSATIONS_ERROR_CODES,
  CONVERSATIONS_ERROR_MESSAGES,
} from '../constants/conversation-constants';
import { WsJwtGuard } from 'src/auth/guards';

describe('DmGateway', () => {
  let gateway: DmGateway;
  let conversationsService: jest.Mocked<ConversationsService>;
  let messagesService: jest.Mocked<MessagesService>;
  let eventPublisher: jest.Mocked<EventPublisherService>;

  const mockUser: WsUser = {
    id: '6',
    username: 'layla',
    displayName: 'Layla',
    avatarUrl: 'https://example.com/avatar.jpg',
  };

  const mockSocket = {
    id: 'socket-123',
    data: { user: mockUser },
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
  } as unknown as Socket;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  } as unknown as Server;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DmGateway,
        {
          provide: ConversationsService,
          useValue: {
            assertParticipant: jest.fn(),
          },
        },
        {
          provide: MessagesService,
          useValue: {
            createMessage: jest.fn(),
            updateLastSeen: jest.fn(),
          },
        },
        {
          provide: EventPublisherService,
          useValue: {
            publishNewMessagePreview: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(WsJwtGuard)
      .useValue({ canActivate: () => true })
      .compile();

    gateway = module.get<DmGateway>(DmGateway);
    conversationsService = module.get(ConversationsService);
    messagesService = module.get(MessagesService);
    eventPublisher = module.get(EventPublisherService);

    gateway.server = mockServer;

    jest.clearAllMocks();
  });

  describe('handleDisconnect', () => {
    it('should clear socket data on disconnect', () => {
      mockSocket.data = { user: mockUser, currentConversationId: '1' };

      gateway.handleDisconnect(mockSocket);

      expect(mockSocket.data).toEqual({});
    });
  });

  describe('mark_seen', () => {
    const payload = {
      conversationId: '2',
      lastSeenMessageId: '12',
    };

    beforeEach(() => {
      mockSocket.data = { user: mockUser };
    });

    it('should successfully mark message as seen and emit update', async () => {
      conversationsService.assertParticipant.mockResolvedValue(true);
      messagesService.updateLastSeen.mockResolvedValue({
        lastSeenMessageId: '12',
        seenAt: new Date('2024-01-01T10:00:00Z'),
        unseenCount: 0,
      });

      await gateway.markSeen(mockSocket, payload);

      expect(conversationsService.assertParticipant).toHaveBeenCalledWith('6', '2');
      expect(messagesService.updateLastSeen).toHaveBeenCalledWith('6', '2', '12');
      expect(mockSocket.join).toHaveBeenCalledWith('2');
      expect(mockServer.to).toHaveBeenCalledWith('2');
      expect(mockServer.emit).toHaveBeenCalledWith('conversation_seen_update', {
        conversationId: '2',
        userId: '6',
        lastSeenMessageId: '12',
        unseenCount: 0,
        seenAt: expect.any(Date) as Date,
      });
    });

    it('should not leave previous room if already in the same conversation', async () => {
      mockSocket.data = { user: mockUser, currentConversationId: '2' };

      conversationsService.assertParticipant.mockResolvedValue(true);
      messagesService.updateLastSeen.mockResolvedValue({
        lastSeenMessageId: '12',
        seenAt: new Date('2024-01-01T10:00:00Z'),
        unseenCount: 0,
      });

      await gateway.markSeen(mockSocket, payload);

      expect(mockSocket.leave).not.toHaveBeenCalled();
      expect(mockSocket.join).not.toHaveBeenCalled();
    });

    it('should leave previous room and join new one when switching conversations', async () => {
      mockSocket.data = { user: mockUser, currentConversationId: '1' };

      conversationsService.assertParticipant.mockResolvedValue(true);
      messagesService.updateLastSeen.mockResolvedValue({
        lastSeenMessageId: '12',
        seenAt: new Date('2024-01-01T10:00:00Z'),
        unseenCount: 0,
      });

      await gateway.markSeen(mockSocket, payload);

      expect(mockSocket.leave).toHaveBeenCalledWith('1');
      expect(mockSocket.join).toHaveBeenCalledWith('2');
      expect(mockSocket.data).toHaveProperty('currentConversationId', '2');
    });

    it('should emit error when conversation does not exist', async () => {
      conversationsService.assertParticipant.mockResolvedValue(null);

      await gateway.markSeen(mockSocket, payload);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.INVALID_CONVERSATION_ID,
        message: CONVERSATIONS_ERROR_MESSAGES.INVALID_CONVERSATION_ID,
      });
      expect(messagesService.updateLastSeen).not.toHaveBeenCalled();
    });

    it('should emit error when user is not a participant', async () => {
      conversationsService.assertParticipant.mockResolvedValue(false);

      await gateway.markSeen(mockSocket, payload);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.FORBIDDEN_CONVERSATION_ID,
        message: CONVERSATIONS_ERROR_MESSAGES.FORBIDDEN_CONVERSATION_ID,
      });
      expect(messagesService.updateLastSeen).not.toHaveBeenCalled();
    });

    it('should emit error when message ID is invalid', async () => {
      conversationsService.assertParticipant.mockResolvedValue(true);
      messagesService.updateLastSeen.mockResolvedValue({
        error: 'INVALID_ID',
      });

      await gateway.markSeen(mockSocket, payload);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.INVALID_MESSAGE_ID,
        message: CONVERSATIONS_ERROR_MESSAGES.INVALID_MESSAGE_ID,
      });
    });

    it('should emit error when update fails', async () => {
      conversationsService.assertParticipant.mockResolvedValue(true);
      messagesService.updateLastSeen.mockResolvedValue({
        error: 'UPDATE_FAILED',
      });

      await gateway.markSeen(mockSocket, payload);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.UPDATE_LAST_SEEN_FAILED,
        message: CONVERSATIONS_ERROR_MESSAGES.UPDATE_LAST_SEEN_FAILED,
      });
    });
  });

  describe('send_message', () => {
    const payload = {
      conversationId: '2',
      body: 'Hello, how are you?',
      clientMessageId: 'client-msg-123',
    };

    const mockMessage = {
      id: BigInt(42),
      userId: BigInt(6),
      conversationId: BigInt(2),
      content: 'Hello, how are you?',
      messageEntities: null,
      createdAt: new Date('2024-01-01T10:00:00Z'),
      mediaUrl: null,
      isDeletedSender: false,
      isDeletedReceiver: false,
    };

    beforeEach(() => {
      mockSocket.data = { user: mockUser };
    });

    it('should successfully send message and emit to room', async () => {
      conversationsService.assertParticipant.mockResolvedValue(true);
      messagesService.createMessage.mockResolvedValue({ message: mockMessage });

      await gateway.sendMessage(mockSocket, payload);

      expect(conversationsService.assertParticipant).toHaveBeenCalledWith('6', '2');
      expect(messagesService.createMessage).toHaveBeenCalledWith('2', '6', 'Hello, how are you?');
      expect(mockSocket.join).toHaveBeenCalledWith('2');
      expect(mockServer.to).toHaveBeenCalledWith('2');
      expect(mockServer.emit).toHaveBeenCalledWith('message_received', {
        conversationId: '2',
        message: {
          id: '42',
          sender: {
            id: '6',
            username: 'layla',
            displayName: 'Layla',
            avatarUrl: 'https://example.com/avatar.jpg',
          },
          body: 'Hello, how are you?',
          createdAt: expect.any(Date) as Date,
        },
      });
      expect(eventPublisher.publishNewMessagePreview).toHaveBeenCalledWith('2', mockMessage);
    });

    it('should join new conversation room when switching conversations', async () => {
      mockSocket.data = { user: mockUser, currentConversationId: '1' };

      conversationsService.assertParticipant.mockResolvedValue(true);
      messagesService.createMessage.mockResolvedValue({ message: mockMessage });

      await gateway.sendMessage(mockSocket, payload);

      expect(mockSocket.leave).toHaveBeenCalledWith('1');
      expect(mockSocket.join).toHaveBeenCalledWith('2');
      expect(mockSocket.data).toHaveProperty('currentConversationId', '2');
    });

    it('should stay in current room when sending to same conversation', async () => {
      mockSocket.data = { user: mockUser, currentConversationId: '2' };

      conversationsService.assertParticipant.mockResolvedValue(true);
      messagesService.createMessage.mockResolvedValue({ message: mockMessage });

      await gateway.sendMessage(mockSocket, payload);

      expect(mockSocket.leave).not.toHaveBeenCalled();
      expect(mockSocket.join).not.toHaveBeenCalled();
    });

    it('should emit error when user is not a participant', async () => {
      conversationsService.assertParticipant.mockResolvedValue(false);

      await gateway.sendMessage(mockSocket, payload);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.NOT_PARTICIPANT,
        message: CONVERSATIONS_ERROR_MESSAGES.NOT_PARTICIPANT,
        clientMessageId: 'client-msg-123',
      });
      expect(messagesService.createMessage).not.toHaveBeenCalled();
    });

    it('should emit error when conversation ID is invalid', async () => {
      conversationsService.assertParticipant.mockResolvedValue(true);
      messagesService.createMessage.mockResolvedValue({
        error: 'INVALID_CONVERSATION_ID',
      });

      await gateway.sendMessage(mockSocket, payload);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.INVALID_CONVERSATION_ID,
        message: CONVERSATIONS_ERROR_MESSAGES.INVALID_CONVERSATION_ID,
        clientMessageId: 'client-msg-123',
      });
    });

    it('should emit error when message creation fails', async () => {
      conversationsService.assertParticipant.mockResolvedValue(true);
      messagesService.createMessage.mockResolvedValue({
        error: 'CREATION_FAILED',
      });

      await gateway.sendMessage(mockSocket, payload);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.MESSAGE_CREATION_FAILED,
        message: CONVERSATIONS_ERROR_MESSAGES.MESSAGE_CREATION_FAILED,
        clientMessageId: 'client-msg-123',
      });
    });

    it('should handle message with empty body', async () => {
      const emptyPayload = { ...payload, body: '' };

      conversationsService.assertParticipant.mockResolvedValue(true);
      messagesService.createMessage.mockResolvedValue({ message: { ...mockMessage, content: '' } });

      await gateway.sendMessage(mockSocket, emptyPayload);

      expect(messagesService.createMessage).toHaveBeenCalledWith('2', '6', '');
    });
  });

  describe('room management', () => {
    it('should handle multiple room switches correctly', async () => {
      mockSocket.data = { user: mockUser };

      conversationsService.assertParticipant.mockResolvedValue(true);
      messagesService.createMessage.mockResolvedValue({
        message: {
          id: BigInt(1),
          userId: BigInt(6),
          conversationId: BigInt(1),
          content: 'Message 1',
          messageEntities: null,
          createdAt: new Date(),
          mediaUrl: null,
          isDeletedSender: false,
          isDeletedReceiver: false,
        },
      });

      await gateway.sendMessage(mockSocket, {
        conversationId: '1',
        body: 'Message 1',
        clientMessageId: 'msg1',
      });

      expect(mockSocket.join).toHaveBeenCalledWith('1');
      expect(mockSocket.data).toHaveProperty('currentConversationId', '1');

      await gateway.sendMessage(mockSocket, {
        conversationId: '2',
        body: 'Message 2',
        clientMessageId: 'msg2',
      });

      expect(mockSocket.leave).toHaveBeenCalledWith('1');
      expect(mockSocket.join).toHaveBeenCalledWith('2');
      expect(mockSocket.data).toHaveProperty('currentConversationId', '2');

      await gateway.sendMessage(mockSocket, {
        conversationId: '1',
        body: 'Message 3',
        clientMessageId: 'msg3',
      });

      expect(mockSocket.leave).toHaveBeenCalledWith('2');
      expect(mockSocket.join).toHaveBeenCalledWith('1');
      expect(mockSocket.data).toHaveProperty('currentConversationId', '1');
    });
  });
});
