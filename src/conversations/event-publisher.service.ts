import { Injectable, Logger } from '@nestjs/common';
import { SseService } from './sse.service';
import { ConversationsService } from './conversations.service';
import { WsUser } from 'src/auth/interfaces';

@Injectable()
export class EventPublisherService {
  private readonly logger = new Logger(EventPublisherService.name);
  constructor(
    private readonly sse: SseService,
    private readonly conversationsService: ConversationsService,
  ) {}

  async publishNewMessagePreview(
    conversationId: string,
    message: {
      id: bigint;
      createdAt: Date;
      conversationId: bigint;
      userId: bigint;
      content: string;
    },
    sender: WsUser,
  ) {
    this.logger.log(
      `Publishing new message preview for conversation ${conversationId}, messageId: ${message.id}`,
    );
    const participants =
      await this.conversationsService.getConversationParticipants(conversationId);

    if (!participants) {
      this.logger.warn(`No participants found for conversation ${conversationId}`);
      return;
    }

    for (const user of participants) {
      this.logger.debug(`Publishing dm.new_message to user ${user.user.id}`);
      this.sse.publish(user.user.id.toString(), {
        event: 'dm.new_message',
        data: {
          messageId: message.id.toString(),
          conversationId,
          sender: {
            id: message.userId.toString(),
            username: sender.username,
            displayName: sender.displayName,
            avatarUrl: sender?.avatarUrl,
          },
          bodySnippet: message.content.slice(0, 80),
          createdAt: message.createdAt,
        },
      });

      if (user.user.id !== message.userId) {
        this.logger.debug(`Publishing unseen_conversations_count to user ${user.user.id}`);
        const unseenCount = await this.conversationsService.countUnseenConversations(user.user.id);

        this.sse.publish(user.user.id.toString(), {
          event: 'dm.unseen_conversations_count',
          data: {
            count: unseenCount,
          },
        });
      }
    }
    this.logger.log(`Finished publishing message preview for conversation ${conversationId}`);
  }
}
