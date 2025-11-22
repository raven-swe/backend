import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

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

  async updateLastSeenMessage(conversationId: bigint, userId: bigint, lastSeenMessageId: bigint) {
    const latestMessage = await this.prisma.message.findFirst({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (!latestMessage) {
      return {
        lastSeenMessageId: null,
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
}
