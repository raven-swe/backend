import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getMessages(
    userId: bigint,
    conversationId: bigint,
    limit: number,
    prevCursor: { messageId: string; createdAt: string } | undefined,
  ) {
    const baseWhere: Prisma.MessageWhereInput = {
      conversationId,
      OR: [
        { userId, isDeletedSender: false },
        { NOT: { userId }, isDeletedReceiver: false },
      ],
    };

    if (prevCursor) {
      const cursorDate = new Date(prevCursor.createdAt);

      const cursorId = BigInt(prevCursor.messageId);

      baseWhere.AND = [
        {
          OR: [
            { createdAt: { lt: cursorDate } },
            { AND: [{ createdAt: cursorDate }, { id: { lte: cursorId } }] },
          ],
        },
      ];
    }

    return await this.prisma.message.findMany({
      where: baseWhere,
      take: limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        content: true,
        createdAt: true,
        userId: true,
      },
    });
  }

  async updateLastSeenMessage(conversationId: bigint, userId: bigint, lastSeenMessageId: bigint) {
    const latestMessage = await this.prisma.message.findFirst({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        user: {
          select: {
            username: true,
          },
        },
      },
    });

    if (!latestMessage) {
      return {
        lastSeenMessageId: null,
        latestMessageUsername: null,
        unseenCount: 0,
      };
    }

    const unseenCount = await this.prisma.message.count({
      where: {
        conversationId,
        userId: { not: userId },
        id: { gt: lastSeenMessageId, lte: latestMessage.id },
      },
    });

    const updated = await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      data: {
        lastSeenMessageId: latestMessage.id,
      },
      select: {
        lastSeenMessageId: true,
      },
    });

    return {
      ...updated,
      unseenCount,
      latestMessageUsername: latestMessage.user.username,
    };
  }

  async createMessage(conversationId: bigint, senderId: bigint, body: string) {
    const message = await this.prisma.message.create({
      data: {
        userId: senderId,
        conversationId,
        content: body,
      },
    });

    await this.prisma.conversation.update({
      where: {
        id: conversationId,
      },
      data: {
        lastMessageId: message.id,
      },
    });
    return message;
  }

  async getMessageById(messageId: bigint) {
    return this.prisma.message.findUnique({
      where: {
        id: messageId,
      },
      select: {
        userId: true,
        conversationId: true,
      },
    });
  }

  async deleteMessage(messageId: bigint, authUserId: bigint, authorId: bigint) {
    const data = authUserId === authorId ? { isDeletedSender: true } : { isDeletedReceiver: true };

    await this.prisma.message.update({
      where: { id: messageId },
      data,
    });
  }
}
