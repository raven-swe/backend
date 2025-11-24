import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { VALIDATION_ERROR_CODES } from 'src/common/constants';
import { ConversationsRepository } from '../conversations.repository';
import { decodeCompositeCursor, paginateComposite } from 'src/common/utils';
import {
  CONVERSATIONS_ERROR_CODES,
  CONVERSATIONS_ERROR_MESSAGES,
} from '../constants/conversation-constants';
import { MessagesRepository } from './messages.repository';
import { ParticipantDto, MessageDto } from './dtos';

@Injectable()
export class MessagesService {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly messagesRepository: MessagesRepository,
  ) {}

  async getMessagesInConversation(
    userId: bigint,
    conversationId: bigint,
    limit: number,
    cursor: string,
  ) {
    const conversation = await this.conversationsRepository.getConversation(conversationId);

    if (!conversation || !conversation.conversationParticipants)
      throw new HttpException(
        {
          message: CONVERSATIONS_ERROR_MESSAGES.INVALID_CONVERSATION_ID,
          code: CONVERSATIONS_ERROR_CODES.INVALID_CONVERSATION_ID,
        },
        HttpStatus.BAD_REQUEST,
      );

    const isParticipant = conversation.conversationParticipants.find(
      (participant) => participant.userId === userId,
    );

    if (!isParticipant) {
      throw new HttpException(
        {
          message: CONVERSATIONS_ERROR_MESSAGES.FORBIDDEN_CONVERSATION_ID,
          code: CONVERSATIONS_ERROR_CODES.FORBIDDEN_CONVERSATION_ID,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    let decoded:
      | {
          messageId: string;
        }
      | undefined;
    if (cursor) {
      try {
        decoded = decodeCompositeCursor<{ messageId: string }>(cursor);
      } catch {
        throw new HttpException(
          { message: 'Invalid cursor format', code: VALIDATION_ERROR_CODES.INVALID_FORMAT },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const messages = await this.messagesRepository.getMessages(conversationId, limit + 1, decoded);

    const otherParticipant = conversation.conversationParticipants.find(
      (participant) => participant.userId !== userId,
    )!;

    const formattedMessages = messages.map((message) => ({
      id: message.id.toString(),
      content: message.content,
      createdAt: message.createdAt,
      isMine: message.userId === userId,
    }));

    const pagination = paginateComposite(formattedMessages, limit, cursor, (item) => ({
      messageId: item.id,
    }));

    const participant = plainToInstance(ParticipantDto, {
      username: otherParticipant.user.username,
      displayName: otherParticipant.user.profile?.displayName ?? '',
      avatarUrl: otherParticipant.user.profile?.avatarUrl,
    });

    const messagesDto = plainToInstance(MessageDto, formattedMessages);

    return { items: { participant, messages: messagesDto }, pagination };
  }

  async updateLastSeen(userId: string, conversationId: string, lastSeenMessageId: string) {
    let userIdBigInt: bigint;
    let conversationIdBigInt: bigint;
    let lastSeenMessageIdBigInt: bigint;

    try {
      userIdBigInt = BigInt(userId);
      conversationIdBigInt = BigInt(conversationId);
      lastSeenMessageIdBigInt = BigInt(lastSeenMessageId);
    } catch {
      return { error: 'INVALID_ID' };
    }

    const updatedParticipant = await this.messagesRepository.updateLastSeenMessage(
      conversationIdBigInt,
      userIdBigInt,
      lastSeenMessageIdBigInt,
    );

    if (!updatedParticipant) {
      return { error: 'UPDATE_FAILED' };
    }

    return {
      lastSeenMessageId: updatedParticipant.lastSeenMessageId?.toString() ?? null,
      seenAt: new Date(),
      unseenCount: updatedParticipant.unseenCount,
      username: updatedParticipant.latestMessageUsername,
    };
  }

  async createMessage(conversationId: string, senderId: string, body: string) {
    let userIdBigInt: bigint;
    let conversationIdBigInt: bigint;

    try {
      userIdBigInt = BigInt(senderId);
      conversationIdBigInt = BigInt(conversationId);
    } catch {
      return { error: 'INVALID_CONVERSATION_ID' };
    }

    const message = await this.messagesRepository.createMessage(
      conversationIdBigInt,
      userIdBigInt,
      body,
    );

    if (!message) {
      return { error: 'MESSAGE_CREATION_FAILED' };
    }

    await this.messagesRepository.updateLastSeenMessage(
      conversationIdBigInt,
      userIdBigInt,
      message.id,
    );

    return { message };
  }
}
