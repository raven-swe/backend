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
import { EventPublisherService } from '../event-publisher.service';
import { WsJwtGuard } from 'src/auth/guards';
import { SendMessageDto } from './dto';
import {
  CONVERSATIONS_ERROR_CODES,
  CONVERSATIONS_ERROR_MESSAGES,
} from '../constants/conversation-constants';
import { WsValidationExceptionFilter } from 'src/common/filters/ws-validation-exception.filter';
import { MarkSeenDto } from './dto/mark-seen.dto';

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
    const user = (client.data as { user?: WsUser }).user;
    this.logger.log(`Client disconnected: ${client.id}, User: ${user?.id || 'anonymous'}`);
    client.data = {};
  }

  @SubscribeMessage('mark_seen')
  @UsePipes(new ValidationPipe({ transform: true }))
  async markSeen(@ConnectedSocket() client: Socket, @MessageBody() payload: MarkSeenDto) {
    const user = (client.data as { user: WsUser }).user;
    this.logger.log(
      `mark_seen event - User: ${user.id}, Conversation: ${payload.conversationId}, Message: ${payload.lastSeenMessageId}`,
    );

    const isAllowed = await this.conversationsService.assertParticipant(
      user.id,
      payload.conversationId,
    );

    if (isAllowed === null) {
      this.logger.warn(`Invalid conversation ID: ${payload.conversationId} for user: ${user.id}`);
      return client.emit('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.INVALID_CONVERSATION_ID,
        message: CONVERSATIONS_ERROR_MESSAGES.INVALID_CONVERSATION_ID,
      });
    } else if (isAllowed === false) {
      this.logger.warn(
        `Forbidden conversation access: ${payload.conversationId} for user: ${user.id}`,
      );
      return client.emit('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.FORBIDDEN_CONVERSATION_ID,
        message: CONVERSATIONS_ERROR_MESSAGES.FORBIDDEN_CONVERSATION_ID,
      });
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

    const { lastSeenMessageId, seenAt, unseenCount } = res;

    const prev = (client.data as { currentConversationId: string }).currentConversationId;

    if (prev !== payload.conversationId) {
      if (prev) await client.leave(prev);
      await client.join(payload.conversationId);
      (client.data as { currentConversationId: string }).currentConversationId =
        payload.conversationId;
    }

    this.server.to(payload.conversationId).emit('conversation_seen_update', {
      conversationId: payload.conversationId,
      userId: user.id,
      lastSeenMessageId,
      unseenCount,
      seenAt,
    });
  }

  @SubscribeMessage('send_message')
  @UsePipes(new ValidationPipe({ transform: true }))
  async sendMessage(@ConnectedSocket() client: Socket, @MessageBody() payload: SendMessageDto) {
    const user = (client.data as { user: WsUser }).user;
    this.logger.log(
      `send_message event - User: ${user.id}, Conversation: ${payload.conversationId}, ClientMsgId: ${payload.clientMessageId}`,
    );

    const conversationId = payload.conversationId;

    const isAllowed = await this.conversationsService.assertParticipant(user.id, conversationId);

    if (!isAllowed) {
      this.logger.warn(`User ${user.id} not participant in conversation: ${conversationId}`);
      return client.emit('error', {
        type: 'error',
        code: CONVERSATIONS_ERROR_CODES.NOT_PARTICIPANT,
        message: CONVERSATIONS_ERROR_MESSAGES.NOT_PARTICIPANT,
        clientMessageId: payload.clientMessageId,
      });
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

    const prev = (client.data as { currentConversationId: string }).currentConversationId;

    if (prev !== conversationId) {
      if (prev) await client.leave(prev);
      await client.join(conversationId);
      (client.data as { currentConversationId: string }).currentConversationId = conversationId;
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
        body: message.content,
        createdAt: message.createdAt,
      },
    });

    await this.publisher.publishNewMessagePreview(conversationId, message);
  }
}
