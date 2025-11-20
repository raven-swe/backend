import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { VALIDATION_ERROR_CODES } from 'src/common/constants';
import { ConversationsRepository } from './conversations.repository';
import { decodeCompositeCursor, paginateComposite } from 'src/common/utils';
import { UsersRepository } from 'src/users/users.repository';
import { DEFAULT_PROFILE_PICTURE, USERS_ERROR_MESSAGES } from 'src/users/constants';
import {
  CONVERSATIONS_ERROR_CODES,
  CONVERSATIONS_ERROR_MESSAGES,
} from './constants/conversation-constants';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  async getUserConversations(userId: bigint, limit: number, cursor: string) {
    let decoded:
      | {
          conversationId: string;
        }
      | undefined;
    if (cursor) {
      try {
        decoded = decodeCompositeCursor<{ conversationId: string }>(cursor);
      } catch {
        throw new HttpException(
          { message: 'Invalid cursor format', code: VALIDATION_ERROR_CODES.INVALID_FORMAT },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const userConversations = await this.conversationsRepository.getUserConversations(
      userId,
      limit + 1,
      decoded,
    );

    const blockedUsers = await this.usersRepository.getUserBlocks(userId);
    const blockedBy = await this.usersRepository.getUserBlockedBy(userId);

    const blockedUserIds = new Set(blockedUsers.map((block) => block.blockedId.toString()));
    const blockedByUserIds = new Set(blockedBy.map((block) => block.userId.toString()));

    const conversationsWithBlockStatus = userConversations
      .filter((conversation) => {
        return conversation.lastMessageId !== null || conversation.creatorId === userId;
      })
      .filter((conversation) => {
        const otherParticipant = conversation.conversationParticipants.find(
          (participant) => participant.userId !== userId,
        );
        return otherParticipant !== undefined;
      })
      .map((conversation) => {
        const otherParticipant = conversation.conversationParticipants.find(
          (participant) => participant.userId !== userId,
        )!;

        const currentUserParticipant = conversation.conversationParticipants.find(
          (participant) => participant.userId === userId,
        )!;

        const otherParticipantId = otherParticipant.userId.toString();

        const isBlockedByMe = blockedUserIds.has(otherParticipantId);
        const isBlockingMe = blockedByUserIds.has(otherParticipantId);

        return {
          id: conversation.id.toString(),
          isMuted: currentUserParticipant.notificationsMuted,
          participant: {
            username: otherParticipant.user.username,
            displayName: otherParticipant.user.profile?.displayName ?? '',
            avatarUrl: otherParticipant.user.profile?.avatarUrl ?? DEFAULT_PROFILE_PICTURE,
          },
          lastMessage: conversation.lastMessage
            ? {
                content: conversation.lastMessage.content,
                senderUsername: conversation.lastMessage.user.username,
                sentAt: conversation.lastMessage.createdAt,
              }
            : null,
          isBlockedByMe,
          isBlockingMe,
        };
      });

    const pagination = paginateComposite(conversationsWithBlockStatus, limit, cursor, (item) => ({
      conversationId: item.id.toString(),
    }));

    return { conversationsWithBlockStatus, pagination };
  }

  async createOrFindConversation(userId: bigint, username: string) {
    const otherUser = await this.usersRepository.getUserByUsername(username);

    if (!otherUser)
      throw new HttpException(
        {
          message: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
          code: USERS_ERROR_MESSAGES.USER_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );

    let conversationData = await this.conversationsRepository.findConversation(
      userId,
      otherUser.id,
    );

    if (!conversationData) {
      const blockedUsers = await this.usersRepository.getUserBlocks(userId);
      const blockedBy = await this.usersRepository.getUserBlockedBy(userId);

      const isBlocking = blockedUsers.some((block) => block.blockedId === otherUser.id);
      const isBlockedBy = blockedBy.some((block) => block.userId === otherUser.id);

      if (isBlocking || isBlockedBy) {
        throw new HttpException(
          {
            message: `Cannot create conversation with ${username}`,
            code: CONVERSATIONS_ERROR_CODES.BLOCKED_USER,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.conversationsRepository.createConversation(userId, otherUser.id);
      conversationData = await this.conversationsRepository.findConversation(userId, otherUser.id);
    }

    if (!conversationData) {
      throw new HttpException(
        {
          message: CONVERSATIONS_ERROR_MESSAGES.CONVERSATION_CREATION_FAILED,
          code: CONVERSATIONS_ERROR_CODES.CONVERSATION_CREATION_FAILED,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const otherParticipant = conversationData.conversationParticipants.find(
      (participant) => participant.userId !== userId,
    )!;

    const currentUserParticipant = conversationData.conversationParticipants.find(
      (participant) => participant.userId === userId,
    )!;

    return {
      id: conversationData.id.toString(),
      participant: {
        username: otherParticipant.user.username,
        displayName: otherParticipant.user.profile?.displayName ?? '',
        avatarUrl: otherParticipant.user.profile?.avatarUrl ?? DEFAULT_PROFILE_PICTURE,
      },
      lastMessage: conversationData.lastMessage
        ? {
            content: conversationData.lastMessage.content,
            senderUsername: conversationData.lastMessage.user.username,
            sentAt: conversationData.lastMessage.createdAt,
          }
        : null,
      isMuted: currentUserParticipant.notificationsMuted,
    };
  }

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

    const messages = await this.conversationsRepository.getMessages(
      conversationId,
      limit + 1,
      decoded,
    );

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
