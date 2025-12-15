import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotificationsRepository } from './notifications.repository';
import { NotificationType } from '@prisma/client';
import { DEFAULT_PROFILE_PICTURE } from 'src/users/constants';
import { Logger } from '@nestjs/common';
import { buildFcmNotificationText } from './utils/fcm-notification-body-builder';
import { NotificationPayloadDto } from './dtos/notification-payload.dto';
import { UsersRepository } from 'src/users/users.repository';
import { PushSenderService } from 'src/firebase/push-sender.service';

interface FcmNotificationData {
  id: string;
  type: NotificationType;
  actorSummary: string;
  messageSummary?: string;
  tweetSubjectIds: string;
  latestEventAt: string;
  isSeen: string;
}

@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly pushService: PushSenderService,
  ) {
    super();
  }

  async process(
    job: Job<{
      notificationId: string;
      userId: string;
    }>,
  ): Promise<void> {
    const { notificationId, userId } = job.data;

    this.logger.log(
      `Processing push notification job for notification id ${notificationId} to user ${userId}`,
    );

    try {
      const notification = await this.notificationsRepository.findByIdForPush(
        BigInt(notificationId),
        BigInt(userId),
      );
      if (!notification) {
        this.logger.warn(
          `Notification with id ${notificationId} not found, skipping push notification`,
        );
        return;
      }
      const currentPayload = (notification.payload as unknown as NotificationPayloadDto) || {
        actorsPreview: [],
        actorsIds: [notification.actor.id.toString()],
      };

      const languageCode = await this.usersRepository.getUserLocale(BigInt(userId));

      let previewActors = [
        {
          username: notification.actor.username,
          displayName: notification.actor.profile?.displayName,
          avatarUrl: notification.actor.profile?.avatarUrl ?? DEFAULT_PROFILE_PICTURE,
          isFollowing: notification.actor.followers.length > 0,
        },
      ];

      previewActors = previewActors.concat(
        currentPayload.actorsPreview.map((a) => ({
          username: a.username,
          displayName: a.displayName ?? undefined,
          avatarUrl: a.avatarUrl ?? DEFAULT_PROFILE_PICTURE,
          isFollowing: a.ifFollowing,
        })),
      );

      const tweetSnippet = notification.tweet?.content ?? null;

      const { title, body } = buildFcmNotificationText({
        notificationType: notification.type,
        isAggregated: Boolean(notification.isAggregated),
        previewActors: previewActors.map((a) => a.displayName || a.username),
        totalActorCount: currentPayload.actorsIds?.length,
        tweetSnippet,
        locale: languageCode,
      });

      this.logger.log(`FCM Notification Text - Title: ${title}, Body: ${body}`);

      const fcmData: FcmNotificationData = {
        id: notification.id.toString(),
        type: notification.type,
        isSeen: String(notification.seen),
        latestEventAt: notification.latestEventAt.toISOString(),
        actorSummary: JSON.stringify(previewActors),
        tweetSubjectIds: JSON.stringify([notification.tweet?.id?.toString()]),
      };

      const payload = {
        token: null,
        notification: {
          title,
          body: body ?? undefined,
          image: previewActors[0]?.avatarUrl ?? DEFAULT_PROFILE_PICTURE,
        },
        data: fcmData as unknown as Record<string, string>,
        android: {
          priority: 'normal' as const,
          notification: {
            channel_id: 'default',
            sound: 'default',
            color: '#e5e7ff',
            tag: notification.dedupeKey ?? undefined,
          },
        },
      };

      this.logger.log(`FCM Payload: ${JSON.stringify(payload)}`);

      await this.pushService.sendToDevices(userId, payload);
    } catch (err) {
      this.logger.error(
        `Failed to process push notification job for notification id ${notificationId} to user ${userId}`,
        err,
      );
      throw err;
    }
  }
}
