import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import * as admin from 'firebase-admin';
import { NotificationsRepository } from './notifications.repository';
import { DevicesRepository } from 'src/devices/devices.repository';
import { NotificationType } from '@prisma/client';
import { DEFAULT_PROFILE_PICTURE } from 'src/users/constants';
import { Logger } from '@nestjs/common';
import { buildFcmNotificationText } from './utils/fcm-notification-body-builder';
import { NotificationPayloadDto } from './dtos/notification-payload.dto';

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
    private readonly devicesRepository: DevicesRepository,
  ) {
    super();
  }

  async process(
    job: Job<{
      notificationId: string;
      userId: string;
      type: 'new_notification' | 'update_notification';
    }>,
  ): Promise<void> {
    const { notificationId, userId, type } = job.data;

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

      const { devices, languageCode } = await this.devicesRepository.getUserDevices(BigInt(userId));
      if (!devices.length) {
        this.logger.warn(`No devices found for user ${userId}, skipping push notification`);
        return;
      }

      this.logger.log(`Found ${devices.length} devices for user ${userId}`);

      const previewActors = currentPayload.actorsPreview.map((a) => ({
        username: a.username,
        displayName: a.displayName ?? undefined,
        avatarUrl: a.avatarUrl ?? DEFAULT_PROFILE_PICTURE,
        isFollowing: a.ifFollowing,
      }));

      if (type === 'new_notification') {
        previewActors.push({
          username: notification.actor.username,
          displayName: notification.actor.profile?.displayName,
          avatarUrl: notification.actor.profile?.avatarUrl ?? DEFAULT_PROFILE_PICTURE,
          isFollowing: notification.actor.followers.length > 0,
        });
      }

      const tweetSnippet = notification.tweet?.content ?? null;

      const { title, body } = buildFcmNotificationText({
        notificationType: notification.type,
        isAggregated: Boolean(notification.isAggregated),
        previewActors: previewActors.map((a) => a.displayName || a.username),
        totalActorCount: currentPayload.actorsIds?.length,
        tweetSnippet,
        locale: languageCode,
      });

      const fcmData: FcmNotificationData = {
        id: notification.id.toString(),
        type: notification.type,
        isSeen: String(notification.seen),
        latestEventAt: notification.latestEventAt.toISOString(),
        actorSummary: JSON.stringify(previewActors),
        tweetSubjectIds: JSON.stringify([notification.tweet?.id?.toString()]),
      };

      this.logger.log(`FCM Data: ${JSON.stringify(fcmData)}`);

      this.logger.log(
        `Sending push notification for notification id ${notificationId} to ${devices.length} devices`,
      );

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

      this.logger.debug(`FCM Payload: ${JSON.stringify(payload)}`);

      const tokens = devices.map((d) => d.fcmToken).filter((t): t is string => !!t);

      const response = await admin.messaging().sendEachForMulticast({
        tokens: tokens,
        notification: payload.notification,
        data: payload.data,
        android: payload.android,
      });

      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const error = resp.error;
            if (
              error?.code === 'messaging/invalid-registration-token' ||
              error?.code === 'messaging/registration-token-not-registered'
            ) {
              failedTokens.push(tokens[idx]);
            }
            this.logger.warn(
              `Failed to send notification to token ${tokens[idx]}: ${error?.message}`,
            );
          }
        });

        if (failedTokens.length > 0) {
          await this.devicesRepository.deleteDevicesByTokens(failedTokens);
          this.logger.log(`Deleted ${failedTokens.length} invalid device tokens`);
        }
      }
    } catch (err) {
      this.logger.error(
        `Failed to process push notification job for notification id ${notificationId} to user ${userId}`,
        err,
      );
      throw err;
    }
  }
}
