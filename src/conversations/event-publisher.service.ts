import { Injectable } from '@nestjs/common';
import { SseService } from './sse.service';
import { ConversationsService } from './conversations.service';
import { DEFAULT_PROFILE_PICTURE } from 'src/users/constants';

@Injectable()
export class EventPublisherService {
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
  ) {
    const participants =
      await this.conversationsService.getConversationParticipants(conversationId);

    if (!participants) {
      return;
    }

    for (const user of participants) {
      this.sse.publish(user.user.id.toString(), {
        event: 'dm.new_message',
        data: {
          messageId: message.id.toString(),
          conversationId,
          sender: {
            id: message.userId.toString(),
            username: user.user.username,
            displayName: user.user.profile?.displayName,
            avatarUrl: user.user.profile?.displayName ?? DEFAULT_PROFILE_PICTURE,
          },
          bodySnippet: message.content.slice(0, 80),
          createdAt: message.createdAt,
        },
      });

      if (user.user.id !== message.userId) {
        const unseenCount = await this.conversationsService.countUnseenConversations(user.user.id);

        this.sse.publish(user.user.id.toString(), {
          event: 'dm.unseen_conversations_count',
          data: {
            count: unseenCount,
          },
        });
      }
    }
  }
}
