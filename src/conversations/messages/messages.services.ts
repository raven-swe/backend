import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { VALIDATION_ERROR_CODES } from 'src/common/constants';
import { ConversationsRepository } from '../conversations.repository';
import { decodeCompositeCursor, paginateComposite } from 'src/common/utils';
import { DEFAULT_PROFILE_PICTURE } from 'src/users/constants';
import {
  CONVERSATIONS_ERROR_CODES,
  CONVERSATIONS_ERROR_MESSAGES,
} from '../constants/conversation-constants';
import { MessagesRepository } from './messages.repository';

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

    return {
      participant: {
        username: otherParticipant.user.username,
        displayName: otherParticipant.user.profile?.displayName ?? '',
        avatarUrl: otherParticipant.user.profile?.avatarUrl ?? DEFAULT_PROFILE_PICTURE,
      },
      messages: formattedMessages,
      pagination,
    };
  }
}
