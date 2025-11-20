import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ConversationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getUserConversations(
    userId: bigint,
    limit: number,
    prevCursor: { conversationId: string } | undefined,
  ) {
    return await this.prisma.conversation.findMany({
      where: {
        conversationParticipants: {
          some: {
            userId,
          },
        },
      },
      take: limit,
      cursor: prevCursor
        ? {
            id: BigInt(prevCursor.conversationId),
          }
        : undefined,
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
        lastMessage: {
          select: {
            content: true,
            user: {
              select: {
                username: true,
              },
            },
            createdAt: true,
          },
        },
      },
      orderBy: {
        lastMessage: {
          createdAt: 'desc',
        },
      },
    });
  }

  async findConversation(authUserId: bigint, otherUserId: bigint) {
    return await this.prisma.conversation.findFirst({
      where: {
        conversationParticipants: {
          every: {
            user: {
              id: {
                in: [authUserId, otherUserId],
              },
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
        lastMessage: {
          select: {
            content: true,
            user: {
              select: {
                username: true,
              },
            },
            createdAt: true,
          },
        },
      },
    });
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

  async getMessages(
    conversationId: bigint,
    limit: number,
    prevCursor: { messageId: string } | undefined,
  ) {
    return await this.prisma.message.findMany({
      where: {
        conversationId: conversationId,
      },
      take: limit,
      cursor: prevCursor
        ? {
            id: BigInt(prevCursor.messageId),
          }
        : undefined,
      select: {
        id: true,
        content: true,
        createdAt: true,
        userId: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
