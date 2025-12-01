/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { DmGateway } from 'src/conversations/gateways/dm.gateway';
import { ConversationsService } from 'src/conversations/conversations.service';
import { MessagesService } from 'src/conversations/messages/messages.services';
import { EventPublisherService } from 'src/conversations/event-publisher.service';
import { Server, Socket } from 'socket.io';
import { WsUser } from 'src/auth/interfaces/ws-user.interface';
import {
  CONVERSATIONS_ERROR_CODES,
  CONVERSATIONS_ERROR_MESSAGES,
} from 'src/conversations/constants/conversation-constants';
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
    to: jest.fn().mockReturnValue({
      emit: jest.fn(),
    }),
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
            publishUnseenCountEvent: jest.fn(),
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

  describe('afterInit', () => {
    it('should log initialization and set up connection listener', () => {
      const mockServerWithOn = {
        on: jest.fn(),
      } as unknown as Server;

      const logSpy = jest.spyOn(gateway['logger'], 'log');

      gateway.afterInit(mockServerWithOn);

      expect(logSpy).toHaveBeenCalledWith('WebSocket server initialized on namespace: /ws/dm');
      expect(mockServerWithOn.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should log raw connection attempts', () => {
      const mockServerWithOn = {
        on: jest.fn((event: string, callback: (socket: { id: string }) => void) => {
          if (event === 'connection') {
            callback({ id: 'test-socket-id' });
          }
        }),
      } as unknown as Server;

      const logSpy = jest.spyOn(gateway['logger'], 'log');

      gateway.afterInit(mockServerWithOn);

      expect(logSpy).toHaveBeenCalledWith('RAW Socket.IO connection attempt: test-socket-id');
    });
  });

  describe('handleConnection', () => {
    it('should log connection with authenticated user', () => {
      const logSpy = jest.spyOn(gateway['logger'], 'log');
      const socketWithUser = {
        id: 'socket-456',
        data: { user: mockUser },
      } as unknown as Socket;

      gateway.handleConnection(socketWithUser);

      expect(logSpy).toHaveBeenCalledWith('Client connected: socket-456, User: 6');
    });

    it('should log connection without authenticated user', () => {
      const logSpy = jest.spyOn(gateway['logger'], 'log');
      const socketWithoutUser = {
        id: 'socket-789',
        data: {},
      } as unknown as Socket;

      gateway.handleConnection(socketWithoutUser);

      expect(logSpy).toHaveBeenCalledWith(
        'Client connected: socket-789, User: not authenticated yet',
      );
    });
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
        username: 'layla',
      });

      await gateway.markSeen(mockSocket, payload);

      expect(conversationsService.assertParticipant).toHaveBeenCalledWith('6', '2');
      expect(messagesService.updateLastSeen).toHaveBeenCalledWith('6', '2', '12');
      expect(mockSocket.join).toHaveBeenCalledWith('2');
      expect(mockServer.to).toHaveBeenCalledWith('2');
      expect(mockServer.emit).toHaveBeenCalledWith('conversation_seen_update', {
        conversationId: '2',
        username: 'layla',
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
        username: 'layla',
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
        username: 'layla',
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

    it('should emit error when user is blocked', async () => {
      conversationsService.assertParticipant.mockResolvedValue({ error: 'BLOCKED_USER' });

      await gateway.markSeen(mockSocket, payload);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.BLOCKED_USER,
        message: CONVERSATIONS_ERROR_MESSAGES.BLOCKED_USER,
      });
      expect(messagesService.updateLastSeen).not.toHaveBeenCalled();
    });

    it('should emit error when assertParticipant returns unknown error', async () => {
      conversationsService.assertParticipant.mockResolvedValue({ error: 'UNKNOWN_ERROR' });

      await gateway.markSeen(mockSocket, payload);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.ASSERT_PARTICPANT_FAILED,
        message: CONVERSATIONS_ERROR_MESSAGES.ASSERT_PARTICPANT_FAILED,
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
            username: 'layla',
            displayName: 'Layla',
            avatarUrl: 'https://example.com/avatar.jpg',
          },
          clientMessageId: 'client-msg-123',
          body: 'Hello, how are you?',
          createdAt: expect.any(Date) as Date,
        },
      });
      expect(eventPublisher.publishNewMessagePreview).toHaveBeenCalledWith(
        '2',
        mockMessage,
        mockUser,
      );
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
        code: CONVERSATIONS_ERROR_CODES.FORBIDDEN_CONVERSATION_ID,
        message: CONVERSATIONS_ERROR_MESSAGES.FORBIDDEN_CONVERSATION_ID,
        clientMessageId: 'client-msg-123',
      });
      expect(messagesService.createMessage).not.toHaveBeenCalled();
    });

    it('should emit error when assertParticipant returns INVALID_CONVERSATION_ID error', async () => {
      conversationsService.assertParticipant.mockResolvedValue({
        error: 'INVALID_CONVERSATION_ID',
      });

      await gateway.sendMessage(mockSocket, payload);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.INVALID_CONVERSATION_ID,
        message: CONVERSATIONS_ERROR_MESSAGES.INVALID_CONVERSATION_ID,
        clientMessageId: 'client-msg-123',
      });
      expect(messagesService.createMessage).not.toHaveBeenCalled();
    });

    it('should emit error when user is blocked', async () => {
      conversationsService.assertParticipant.mockResolvedValue({ error: 'BLOCKED_USER' });

      await gateway.sendMessage(mockSocket, payload);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.BLOCKED_USER,
        message: CONVERSATIONS_ERROR_MESSAGES.BLOCKED_USER,
        clientMessageId: 'client-msg-123',
      });
      expect(messagesService.createMessage).not.toHaveBeenCalled();
    });

    it('should emit error when assertParticipant fails with unknown error', async () => {
      conversationsService.assertParticipant.mockResolvedValue({ error: 'SOME_OTHER_ERROR' });

      await gateway.sendMessage(mockSocket, payload);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.ASSERT_PARTICPANT_FAILED,
        message: CONVERSATIONS_ERROR_MESSAGES.ASSERT_PARTICPANT_FAILED,
        clientMessageId: 'client-msg-123',
      });
      expect(messagesService.createMessage).not.toHaveBeenCalled();
    });

    it('should emit error when assertParticipant returns null', async () => {
      conversationsService.assertParticipant.mockResolvedValue(null);

      await gateway.sendMessage(mockSocket, payload);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.INVALID_CONVERSATION_ID,
        message: CONVERSATIONS_ERROR_MESSAGES.INVALID_CONVERSATION_ID,
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

  describe('typing_start', () => {
    const payload = {
      conversationId: '2',
    };

    beforeEach(() => {
      mockSocket.data = { user: mockUser };
    });

    it('should successfully broadcast typing indicator to other users', async () => {
      conversationsService.assertParticipant.mockResolvedValue(true);

      await gateway.typingStart(mockSocket, payload);

      expect(conversationsService.assertParticipant).toHaveBeenCalledWith('6', '2');
      expect(mockSocket.join).toHaveBeenCalledWith('2');
      expect(mockSocket.to).toHaveBeenCalledWith('2');
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should emit user_typing event with correct payload', async () => {
      const emitMock = jest.fn();
      const toMock = jest.fn().mockReturnValue({
        emit: emitMock,
      });
      mockSocket.to = toMock;

      conversationsService.assertParticipant.mockResolvedValue(true);

      await gateway.typingStart(mockSocket, payload);

      expect(emitMock).toHaveBeenCalledWith('user_typing', {
        conversationId: '2',
        username: 'layla',
      });
    });

    it('should not leave previous room if already in the same conversation', async () => {
      mockSocket.data = { user: mockUser, currentConversationId: '2' };
      conversationsService.assertParticipant.mockResolvedValue(true);

      await gateway.typingStart(mockSocket, payload);

      expect(mockSocket.leave).not.toHaveBeenCalled();
      expect(mockSocket.join).not.toHaveBeenCalled();
    });

    it('should leave previous room and join new one when switching conversations', async () => {
      mockSocket.data = { user: mockUser, currentConversationId: '1' };
      conversationsService.assertParticipant.mockResolvedValue(true);

      await gateway.typingStart(mockSocket, payload);

      expect(mockSocket.leave).toHaveBeenCalledWith('1');
      expect(mockSocket.join).toHaveBeenCalledWith('2');
      expect(mockSocket.data).toHaveProperty('currentConversationId', '2');
    });

    it('should emit error when conversation ID is invalid', async () => {
      conversationsService.assertParticipant.mockResolvedValue(null);

      await gateway.typingStart(mockSocket, payload);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.INVALID_CONVERSATION_ID,
        message: CONVERSATIONS_ERROR_MESSAGES.INVALID_CONVERSATION_ID,
      });
    });

    it('should emit error when user is blocked', async () => {
      conversationsService.assertParticipant.mockResolvedValue({ error: 'BLOCKED_USER' });

      await gateway.typingStart(mockSocket, payload);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.BLOCKED_USER,
        message: CONVERSATIONS_ERROR_MESSAGES.BLOCKED_USER,
      });
    });

    it('should emit error when access is forbidden', async () => {
      conversationsService.assertParticipant.mockResolvedValue(false);

      await gateway.typingStart(mockSocket, payload);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.FORBIDDEN_CONVERSATION_ID,
        message: CONVERSATIONS_ERROR_MESSAGES.FORBIDDEN_CONVERSATION_ID,
      });
    });

    it('should emit error when assertParticipant fails', async () => {
      conversationsService.assertParticipant.mockResolvedValue({ error: 'UNKNOWN_ERROR' });

      await gateway.typingStart(mockSocket, payload);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.ASSERT_PARTICPANT_FAILED,
        message: CONVERSATIONS_ERROR_MESSAGES.ASSERT_PARTICPANT_FAILED,
      });
    });

    it('should log typing start event', async () => {
      const logSpy = jest.spyOn(gateway['logger'], 'log');
      conversationsService.assertParticipant.mockResolvedValue(true);

      await gateway.typingStart(mockSocket, payload);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('typing_start event'));
    });

    it('should not broadcast if participant validation fails', async () => {
      conversationsService.assertParticipant.mockResolvedValue(null);

      await gateway.typingStart(mockSocket, payload);

      expect(mockSocket.to).not.toHaveBeenCalled();
    });
  });

  describe('typing_stop', () => {
    const payload = {
      conversationId: '2',
    };

    beforeEach(() => {
      mockSocket.data = { user: mockUser, currentConversationId: '2' };
    });

    it('should successfully broadcast typing stop indicator to other users', async () => {
      conversationsService.assertParticipant.mockResolvedValue(true);

      await gateway.typingStop(mockSocket, payload);

      expect(conversationsService.assertParticipant).toHaveBeenCalledWith('6', '2');
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should emit user_typing_stop event with correct payload', async () => {
      const emitMock = jest.fn();
      const toMock = jest.fn().mockReturnValue({
        emit: emitMock,
      });
      mockSocket.to = toMock;

      conversationsService.assertParticipant.mockResolvedValue(true);

      await gateway.typingStop(mockSocket, payload);

      expect(emitMock).toHaveBeenCalledWith('user_typing_stop', {
        conversationId: '2',
        username: 'layla',
      });
    });

    it('should emit error when conversation ID is invalid', async () => {
      conversationsService.assertParticipant.mockResolvedValue(null);

      await gateway.typingStop(mockSocket, payload);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.INVALID_CONVERSATION_ID,
        message: CONVERSATIONS_ERROR_MESSAGES.INVALID_CONVERSATION_ID,
      });
    });

    it('should emit error when user is blocked', async () => {
      conversationsService.assertParticipant.mockResolvedValue({ error: 'BLOCKED_USER' });

      await gateway.typingStop(mockSocket, payload);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.BLOCKED_USER,
        message: CONVERSATIONS_ERROR_MESSAGES.BLOCKED_USER,
      });
    });

    it('should emit error when access is forbidden', async () => {
      conversationsService.assertParticipant.mockResolvedValue(false);

      await gateway.typingStop(mockSocket, payload);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.FORBIDDEN_CONVERSATION_ID,
        message: CONVERSATIONS_ERROR_MESSAGES.FORBIDDEN_CONVERSATION_ID,
      });
    });

    it('should emit error when assertParticipant fails', async () => {
      conversationsService.assertParticipant.mockResolvedValue({ error: 'ASSERT_FAILED' });

      await gateway.typingStop(mockSocket, payload);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.ASSERT_PARTICPANT_FAILED,
        message: CONVERSATIONS_ERROR_MESSAGES.ASSERT_PARTICPANT_FAILED,
      });
    });

    it('should log typing stop event', async () => {
      const logSpy = jest.spyOn(gateway['logger'], 'log');
      conversationsService.assertParticipant.mockResolvedValue(true);

      await gateway.typingStop(mockSocket, payload);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('typing_stop event'));
    });

    it('should not broadcast if participant validation fails', async () => {
      conversationsService.assertParticipant.mockResolvedValue(null);

      await gateway.typingStop(mockSocket, payload);

      expect(mockSocket.to).not.toHaveBeenCalled();
    });

    it('should broadcast username in stop event (lightweight)', async () => {
      const emitMock = jest.fn();
      const toMock = jest.fn().mockReturnValue({
        emit: emitMock,
      });
      mockSocket.to = toMock;

      conversationsService.assertParticipant.mockResolvedValue(true);

      await gateway.typingStop(mockSocket, payload);

      expect(emitMock).toHaveBeenCalledWith('user_typing_stop', {
        conversationId: '2',
        username: 'layla',
      });

      const callArgs = emitMock.mock.calls[0] as Array<unknown>;
      const eventData = callArgs?.[1] as Record<string, unknown>;
      expect(Object.keys(eventData || {})).toHaveLength(2);
    });
  });
});
