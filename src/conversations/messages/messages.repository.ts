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
}
