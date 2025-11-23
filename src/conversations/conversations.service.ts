import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { VALIDATION_ERROR_CODES } from 'src/common/constants';
import { ConversationsRepository } from './conversations.repository';
import { decodeCompositeCursor, paginateComposite } from 'src/common/utils';
import { UsersRepository } from 'src/users/users.repository';
import { DEFAULT_PROFILE_PICTURE, USERS_ERROR_MESSAGES } from 'src/users/constants';
import {
  CONVERSATIONS_ERROR_CODES,
  CONVERSATIONS_ERROR_MESSAGES,
} from './constants/conversation-constants';
import { ConversationDto } from './dtos';

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
                seen: conversation.lastMessageId === currentUserParticipant.lastSeenMessageId,
              }
            : null,
          isBlocking: isBlockedByMe,
          isBlockedBy: isBlockingMe,
        };
      });

    const pagination = paginateComposite(conversationsWithBlockStatus, limit, cursor, (item) => ({
      conversationId: item.id.toString(),
    }));

    const itemsDto = plainToInstance(ConversationDto, conversationsWithBlockStatus);

    return { items: itemsDto, pagination };
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

    const blockedUsers = await this.usersRepository.getUserBlocks(userId);
    const blockedBy = await this.usersRepository.getUserBlockedBy(userId);

    const isBlocking = blockedUsers.some((block) => block.blockedId === otherUser.id);
    const isBlockedBy = blockedBy.some((block) => block.userId === otherUser.id);

    if (!conversationData) {
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
      isBlocking,
      isBlockedBy,
    };
  }

  async assertParticipant(userId: string, conversationId: string) {
    let userIdBigInt: bigint;
    let conversationIdBigInt: bigint;

    try {
      userIdBigInt = BigInt(userId);
      conversationIdBigInt = BigInt(conversationId);
    } catch {
      return null;
    }

    const currentConversationParticipants = await this.getConversationParticipants(conversationId);

    if (!currentConversationParticipants || currentConversationParticipants.length !== 2)
      return { error: CONVERSATIONS_ERROR_CODES.INVALID_CONVERSATION_ID };

    const isBlocked = await this.usersRepository.getBlockingBlockedState(
      currentConversationParticipants[0].user.id,
      currentConversationParticipants[1].user.id,
    );

    if (isBlocked) return { error: CONVERSATIONS_ERROR_CODES.BLOCKED_USER };

    return await this.conversationsRepository.assertParticipant(userIdBigInt, conversationIdBigInt);
  }

  async getConversationParticipants(conversationId: string) {
    let conversationIdBigInt: bigint;

    try {
      conversationIdBigInt = BigInt(conversationId);
    } catch {
      return null;
    }

    return this.conversationsRepository.getConversationParticipants(conversationIdBigInt);
  }

  async countUnseenConversations(userId: bigint) {
    return this.conversationsRepository.countUnseenConversations(userId);
  }
}
