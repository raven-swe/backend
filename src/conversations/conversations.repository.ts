import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ConversationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getUserConversations(
    userId: bigint,
    limit: number,
    prevCursor: { conversationId: string; lastMessageCreatedAt: string } | undefined,
  ) {
    const visibleMessageFilter = {
      OR: [
        { userId, isDeletedSender: false },
        { NOT: { userId }, isDeletedReceiver: false },
      ],
    };

    const baseWhere: Prisma.ConversationWhereInput = {
      conversationParticipants: { some: { userId } },
      messages: { some: visibleMessageFilter },
      lastMessageId: { not: null },
    };

    if (prevCursor) {
      const cursorDate = new Date(prevCursor.lastMessageCreatedAt);
      const cursorConvId = BigInt(prevCursor.conversationId);

      baseWhere.AND = [
        {
          OR: [
            { lastMessage: { createdAt: { lt: cursorDate } } },
            {
              AND: [{ lastMessage: { createdAt: cursorDate } }, { id: { lte: cursorConvId } }],
            },
          ],
        },
      ];
    }

    const conversations = await this.prisma.conversation.findMany({
      where: baseWhere,
      take: limit,
      orderBy: [{ lastMessage: { createdAt: 'desc' } }, { id: 'desc' }],
      select: {
        id: true,
        creatorId: true,
        lastMessageId: true,
        conversationParticipants: {
          select: {
            userId: true,
            notificationsMuted: true,
            lastSeenMessageId: true,
            user: {
              select: {
                profile: {
                  select: {
                    displayName: true,
                    avatarUrl: true,
                  },
                },
                username: true,
              },
            },
          },
        },
        messages: {
          where: visibleMessageFilter,
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            content: true,
            createdAt: true,
            user: { select: { username: true } },
          },
        },
      },
    });

    return conversations.map((conv) => ({
      ...conv,
      lastMessage: conv.messages[0] ?? null,
    }));
  }

  async findConversation(authUserId: bigint, otherUserId: bigint) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        conversationParticipants: {
          every: {
            userId: {
              in: [authUserId, otherUserId],
            },
          },
        },
      },
      select: {
        id: true,
        creatorId: true,
        lastMessageId: true,
        conversationParticipants: {
          select: {
            userId: true,
            notificationsMuted: true,
            user: {
              select: {
                username: true,
                profile: {
                  select: {
                    displayName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
        messages: {
          where: {
            OR: [
              {
                userId: authUserId,
                isDeletedSender: false,
              },
              {
                NOT: { userId: authUserId },
                isDeletedReceiver: false,
              },
            ],
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          select: {
            content: true,
            createdAt: true,
            user: {
              select: {
                username: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) return null;

    return {
      ...conversation,
      lastMessage: conversation.messages[0] ?? null,
    };
  }

  async createConversation(authUserId: bigint, otherUserId: bigint) {
    return await this.prisma.$transaction(async (tx) => {
      const newConv = await tx.conversation.create({
        data: {
          creatorId: authUserId,
        },
      });

      await tx.conversationParticipant.createMany({
        data: [
          {
            conversationId: newConv.id,
            userId: authUserId,
          },
          {
            conversationId: newConv.id,
            userId: otherUserId,
          },
        ],
      });

      return newConv;
    });
  }

  async getConversation(conversationId: bigint) {
    return await this.prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
      select: {
        conversationParticipants: {
          select: {
            userId: true,
            lastSeenMessageId: true,
            user: {
              select: {
                username: true,
                profile: {
                  select: {
                    displayName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async assertParticipant(userId: bigint, conversationId: bigint) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    });

    return !!participant;
  }

  async getConversationParticipants(conversationId: bigint) {
    return this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: {
        user: {
          select: {
            username: true,
            id: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
  }

  async countUnseenConversations(userId: bigint) {
    const conversations = await this.prisma.conversationParticipant.findMany({
      where: {
        userId,
        conversation: {
          lastMessageId: { not: null },
        },
      },
      select: {
        lastSeenMessageId: true,
        conversation: {
          select: {
            lastMessageId: true,
          },
        },
      },
    });

    return conversations.filter((conv) => {
      const { lastSeenMessageId, conversation } = conv;
      const lastMessageId = conversation.lastMessageId;

      if (!lastMessageId) return false;
      if (!lastSeenMessageId) return true;

      return lastSeenMessageId < lastMessageId;
    }).length;
  }
}
