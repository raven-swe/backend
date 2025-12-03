import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayDisconnect,
  OnGatewayConnection,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { UseGuards, UsePipes, ValidationPipe, UseFilters, Logger } from '@nestjs/common';
import { WsUser } from 'src/auth/interfaces/ws-user.interface';

import { Server, Socket } from 'socket.io';
import { ConversationsService } from '../conversations.service';
import { MessagesService } from '../messages/messages.services';
import { EventPublisherService } from '../../sse/event-publisher.service';
import { WsJwtGuard } from 'src/auth/guards';
import { SendMessageDto } from './dto/send-message.dto';
import {
  CONVERSATIONS_ERROR_CODES,
  CONVERSATIONS_ERROR_MESSAGES,
} from '../constants/conversation-constants';
import { WsValidationExceptionFilter } from 'src/common/filters/ws-validation-exception.filter';
import { MarkSeenDto } from './dto/mark-seen.dto';
import { TypingIndicatorDto } from './dto/typing-indicator.dto';

@WebSocketGateway({
  namespace: '/ws/dm',
  cors: { origin: '*' },
})
@UseGuards(WsJwtGuard)
@UseFilters(new WsValidationExceptionFilter())
export class DmGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(DmGateway.name);
  @WebSocketServer() server: Server;

  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly publisher: EventPublisherService,
  ) {
    this.logger.log('DmGateway initialized');
  }

  afterInit(server: Server) {
    this.logger.log('WebSocket server initialized on namespace: /ws/dm');
    server.on('connection', (socket) => {
      this.logger.log(`RAW Socket.IO connection attempt: ${socket.id}`);
    });
  }

  handleConnection(@ConnectedSocket() client: Socket) {
    const user = (client.data as { user?: WsUser }).user;
    this.logger.log(`Client connected: ${client.id}, User: ${user?.id || 'not authenticated yet'}`);
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    const { user, currentConversationId, isTyping } = client.data as {
      user?: WsUser;
      currentConversationId?: string;
      isTyping?: boolean;
    };

    if (user && currentConversationId && isTyping) {
      this.server.to(currentConversationId).emit('user_typing_stop', {
        conversationId: currentConversationId,
        username: user.username,
      });
    }

    this.logger.log(`Client disconnected: ${client.id}, User: ${user?.id || 'anonymous'}`);
    client.data = {};
  }

  private handleParticipantError(
    client: Socket,
    isAllowed: boolean | null | { error: string },
    userId: bigint,
    conversationId: string,
    clientMessageId?: string,
  ): boolean {
    if (isAllowed !== null && typeof isAllowed === 'object' && 'error' in isAllowed) {
      const errorCode: string =
        isAllowed.error === 'INVALID_CONVERSATION_ID'
          ? CONVERSATIONS_ERROR_CODES.INVALID_CONVERSATION_ID
          : isAllowed.error === 'BLOCKED_USER'
            ? CONVERSATIONS_ERROR_CODES.BLOCKED_USER
            : CONVERSATIONS_ERROR_CODES.ASSERT_PARTICPANT_FAILED;
      const errorMessage: string =
        isAllowed.error === 'INVALID_CONVERSATION_ID'
          ? CONVERSATIONS_ERROR_MESSAGES.INVALID_CONVERSATION_ID
          : isAllowed.error === 'BLOCKED_USER'
            ? CONVERSATIONS_ERROR_MESSAGES.BLOCKED_USER
            : CONVERSATIONS_ERROR_MESSAGES.ASSERT_PARTICPANT_FAILED;

      client.emit('error', {
        type: 'error',
        code: errorCode,
        message: errorMessage,
        ...(clientMessageId && { clientMessageId }),
      });
      return true;
    } else if (isAllowed === null) {
      this.logger.warn(`Invalid conversation ID: ${conversationId} for user: ${userId}`);
      client.emit('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.INVALID_CONVERSATION_ID,
        message: CONVERSATIONS_ERROR_MESSAGES.INVALID_CONVERSATION_ID,
        ...(clientMessageId && { clientMessageId }),
      });
      return true;
    } else if (isAllowed === false) {
      this.logger.warn(`Forbidden conversation access: ${conversationId} for user: ${userId}`);
      client.emit('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.FORBIDDEN_CONVERSATION_ID,
        message: CONVERSATIONS_ERROR_MESSAGES.FORBIDDEN_CONVERSATION_ID,
        ...(clientMessageId && { clientMessageId }),
      });
      return true;
    }

    return false;
  }

  private async publishUnseenCountEvent(userId: bigint): Promise<void> {
    this.logger.log(`Publishing unseen_conversations_count to user ${userId}`);
    const unseenCount = await this.conversationsService.countUnseenConversations(userId);
    await this.publisher.publishToUser(userId.toString(), {
      event: 'dm.unseen_conversations_count',
      data: { count: unseenCount },
    });
  }

  private async publishNewMessagePreview(
    conversationId: string,
    message: {
      id: bigint;
      createdAt: Date;
      conversationId: bigint;
      userId: bigint;
      content: string;
    },
    sender: WsUser,
  ) {
    this.logger.log(
      `Publishing new message preview for conversation ${conversationId}, messageId: ${message.id}`,
    );

    const participants =
      await this.conversationsService.getConversationParticipants(conversationId);

    if (!participants) {
      this.logger.warn(`No participants found for conversation ${conversationId}`);
      return;
    }

    for (const participant of participants) {
      const userId = participant.user.id;
      this.logger.log(`Publishing dm.new_message to user ${userId}`);

      await this.publisher.publishToUser(userId.toString(), {
        event: 'dm.new_message',
        data: {
          messageId: message.id.toString(),
          conversationId,
          sender: {
            id: message.userId.toString(),
            username: sender.username,
            displayName: sender.displayName,
            avatarUrl: sender?.avatarUrl,
          },
          bodySnippet: message.content.slice(0, 80),
          createdAt: message.createdAt,
        },
      });

      if (userId !== message.userId) {
        await this.publishUnseenCountEvent(userId);
      }
    }

    this.logger.log(`Finished publishing message preview for conversation ${conversationId}`);
  }

  @SubscribeMessage('mark_seen')
  @UsePipes(new ValidationPipe({ transform: true }))
  async markSeen(@ConnectedSocket() client: Socket, @MessageBody() payload: MarkSeenDto) {
    const data = client.data as {
      user: WsUser;
      currentConversationId?: string;
    };
    const user = data.user;

    this.logger.log(
      `mark_seen event - User: ${user.id}, Conversation: ${payload.conversationId}, Message: ${payload.lastSeenMessageId}`,
    );

    const isAllowed = await this.conversationsService.assertParticipant(
      user.id,
      payload.conversationId,
    );

    if (this.handleParticipantError(client, isAllowed, BigInt(user.id), payload.conversationId)) {
      return;
    }

    const res = await this.messagesService.updateLastSeen(
      user.id,
      payload.conversationId,
      payload.lastSeenMessageId,
    );

    if ('error' in res) {
      const errorCode: string =
        res.error === 'INVALID_ID'
          ? CONVERSATIONS_ERROR_CODES.INVALID_MESSAGE_ID
          : CONVERSATIONS_ERROR_CODES.UPDATE_LAST_SEEN_FAILED;
      const errorMessage: string =
        res.error === 'INVALID_ID'
          ? CONVERSATIONS_ERROR_MESSAGES.INVALID_MESSAGE_ID
          : CONVERSATIONS_ERROR_MESSAGES.UPDATE_LAST_SEEN_FAILED;

      return client.emit('error', {
        type: 'error',
        code: errorCode,
        message: errorMessage,
      });
    }

    await this.publishUnseenCountEvent(BigInt(user.id));

    const { lastSeenMessageId, seenAt, username, unseenCount } = res;

    const prev = data.currentConversationId;

    if (prev !== payload.conversationId) {
      if (prev) await client.leave(prev);
      await client.join(payload.conversationId);
      data.currentConversationId = payload.conversationId;
    }

    this.server.to(payload.conversationId).emit('conversation_seen_update', {
      conversationId: payload.conversationId,
      username,
      lastSeenMessageId,
      unseenCount,
      seenAt,
    });
  }

  @SubscribeMessage('send_message')
  @UsePipes(new ValidationPipe({ transform: true }))
  async sendMessage(@ConnectedSocket() client: Socket, @MessageBody() payload: SendMessageDto) {
    const data = client.data as {
      user: WsUser;
      currentConversationId?: string;
    };
    const user = data.user;

    this.logger.log(
      `send_message event - User: ${user.id}, Conversation: ${payload.conversationId}, ClientMsgId: ${payload.clientMessageId}`,
    );

    const conversationId = payload.conversationId;

    const isAllowed = await this.conversationsService.assertParticipant(user.id, conversationId);

    if (
      this.handleParticipantError(
        client,
        isAllowed,
        BigInt(user.id),
        conversationId,
        payload.clientMessageId,
      )
    ) {
      return;
    }

    const result = await this.messagesService.createMessage(conversationId, user.id, payload.body);

    if ('error' in result) {
      this.logger.error(
        `Message creation failed - User: ${user.id}, Conversation: ${conversationId}, Error: ${result.error}`,
      );
      const errorCode: string =
        result.error === 'INVALID_CONVERSATION_ID'
          ? CONVERSATIONS_ERROR_CODES.INVALID_CONVERSATION_ID
          : CONVERSATIONS_ERROR_CODES.MESSAGE_CREATION_FAILED;
      const errorMessage: string =
        result.error === 'INVALID_CONVERSATION_ID'
          ? CONVERSATIONS_ERROR_MESSAGES.INVALID_CONVERSATION_ID
          : CONVERSATIONS_ERROR_MESSAGES.MESSAGE_CREATION_FAILED;

      return client.emit('error', {
        type: 'error',
        code: errorCode,
        message: errorMessage,
        clientMessageId: payload.clientMessageId,
      });
    }

    const message = result.message;

    this.logger.log(
      `Message created successfully - ID: ${message.id}, User: ${user.id}, Conversation: ${conversationId}`,
    );

    const prev = data.currentConversationId;

    if (prev !== conversationId) {
      if (prev) await client.leave(prev);
      await client.join(conversationId);
      data.currentConversationId = conversationId;
      this.logger.log(`User ${user.id} joined room: ${conversationId}`);
    }

    this.server.to(conversationId).emit('message_received', {
      conversationId,
      message: {
        id: message.id.toString(),
        sender: {
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        },
        clientMessageId: payload.clientMessageId,
        body: message.content,
        createdAt: message.createdAt,
      },
    });

    await this.publishNewMessagePreview(conversationId, message, user);
  }

  @SubscribeMessage('typing_start')
  @UsePipes(new ValidationPipe({ transform: true }))
  async typingStart(@ConnectedSocket() client: Socket, @MessageBody() payload: TypingIndicatorDto) {
    const data = client.data as {
      user: WsUser;
      currentConversationId?: string;
      isTyping?: boolean;
    };
    const user = data.user;

    this.logger.log(
      `typing_start event - User: ${user.id}, Conversation: ${payload.conversationId}`,
    );

    const conversationId = payload.conversationId;

    const isAllowed = await this.conversationsService.assertParticipant(user.id, conversationId);

    if (this.handleParticipantError(client, isAllowed, BigInt(user.id), payload.conversationId)) {
      return;
    }

    const prev = data.currentConversationId;

    if (prev && prev !== conversationId && data.isTyping) {
      this.server.to(prev).emit('user_typing_stop', {
        conversationId: prev,
        username: user.username,
      });
    }

    if (prev !== conversationId) {
      if (prev) await client.leave(prev);
      await client.join(conversationId);
      data.currentConversationId = conversationId;
      this.logger.log(`User ${user.id} joined room: ${conversationId}`);
    }

    if (data.isTyping && prev === conversationId) {
      return;
    }

    data.isTyping = true;

    client.to(conversationId).emit('user_typing', {
      conversationId,
      username: user.username,
    });
  }

  @SubscribeMessage('typing_stop')
  @UsePipes(new ValidationPipe({ transform: true }))
  async typingStop(@ConnectedSocket() client: Socket, @MessageBody() payload: TypingIndicatorDto) {
    const data = client.data as {
      user: WsUser;
      currentConversationId?: string;
      isTyping?: boolean;
    };
    const user = data.user;

    this.logger.log(
      `typing_stop event - User: ${user.id}, Conversation: ${payload.conversationId}`,
    );

    const conversationId = payload.conversationId;

    const isAllowed = await this.conversationsService.assertParticipant(user.id, conversationId);

    if (this.handleParticipantError(client, isAllowed, BigInt(user.id), payload.conversationId)) {
      return;
    }

    const prev = data.currentConversationId;

    if (prev && prev !== conversationId) {
      if (prev) await client.leave(prev);
      await client.join(conversationId);
      data.currentConversationId = conversationId;
      this.logger.log(`User ${user.id} joined room: ${conversationId}`);
    }

    data.isTyping = false;

    client.to(conversationId).emit('user_typing_stop', {
      conversationId,
      username: user.username,
    });
  }
}
