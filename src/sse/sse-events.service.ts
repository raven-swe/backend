import { Injectable, Logger } from '@nestjs/common';
import { EventPublisherService } from './event-publisher.service';
import { NotificationResponseDto } from 'src/notifications/dtos/notification-response.dto';

export interface NewMessagePayload {
  messageId: string;
  conversationId: string;
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  bodySnippet: string;
  createdAt: Date;
  hasMedia: boolean;
}

export const SSE_EVENTS = {
  DM_UNSEEN_COUNT: 'dm.unseen_conversations_count',
  DM_NEW_MESSAGE: 'dm.new_message',
} as const;

@Injectable()
export class SseEventsService {
  private readonly logger = new Logger(SseEventsService.name);

  constructor(private readonly publisher: EventPublisherService) {}

  async publishUnseenCount(userId: bigint, count: number): Promise<void> {
    this.logger.log(`Publishing unseen count (${count}) to user ${userId}`);
    await this.publisher.publishToUser(userId.toString(), {
      event: SSE_EVENTS.DM_UNSEEN_COUNT,
      data: { count },
    });
  }

  async publishNewMessagePreview(userId: bigint, payload: NewMessagePayload): Promise<void> {
    this.logger.log(
      `Publishing new message preview to user ${userId} for conversation ${payload.conversationId}`,
    );
    await this.publisher.publishToUser(userId.toString(), {
      event: SSE_EVENTS.DM_NEW_MESSAGE,
      data: payload,
    });
  }

  async publishNewNotification(
    recieverId: bigint,
    notification: NotificationResponseDto,
    updatedCount: number,
  ): Promise<void> {
    this.logger.log(`Publishing notification to user ${recieverId}`);
    await this.publisher.publishToUser(recieverId.toString(), {
      event: 'notifications.new',
      data: notification,
    });

    await this.publisher.publishToUser(recieverId.toString(), {
      event: 'notifications.count_update',
      data: { count: updatedCount },
    });
  }

  async publishNotificationSeen(
    receiverId: bigint,
    notificationId?: bigint,
    unSeenCount?: number,
  ): Promise<void> {
    this.logger.log(`Publishing notification seen event to user ${receiverId}`);
    await this.publisher.publishToUser(receiverId.toString(), {
      event: 'notifications.seen',
      data: {
        notificationId: notificationId?.toString() ?? null,
        scope: notificationId ? 'SINGLE' : 'ALL',
        unSeenCount: unSeenCount ?? 0,
      },
    });
  }

  async publishUnseenNotificationCount(userId: bigint, count: number): Promise<void> {
    this.logger.log(`Publishing unseen notification count (${count}) to user ${userId}`);
    await this.publisher.publishToUser(userId.toString(), {
      event: 'notifications.count_update',
      data: { count },
    });
  }
  async publishNotificationDeleted(receiverId: bigint, updatedCount: number): Promise<void> {
    this.logger.log(`Publishing notification deleted event to user ${receiverId}`);
    await this.publisher.publishToUser(receiverId.toString(), {
      event: 'notifications.delete',
      data: {},
    });
    await this.publisher.publishToUser(receiverId.toString(), {
      event: 'notifications.count_update',
      data: { count: updatedCount },
    });
  }

  async publishNotificationUpdate(
    receiverId: bigint,
    notifications: NotificationResponseDto,
    updatedCount: number,
  ): Promise<void> {
    this.logger.log(`Publishing notification update event to user ${receiverId}`);
    await this.publisher.publishToUser(receiverId.toString(), {
      event: 'notifications.update',
      data: notifications,
    });

    await this.publisher.publishToUser(receiverId.toString(), {
      event: 'notifications.count_update',
      data: { count: updatedCount },
    });
  }
}
