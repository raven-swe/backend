import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import * as admin from 'firebase-admin';
import { NotificationsRepository } from './notifications.repository';
import { DevicesRepository } from 'src/devices/devices.repository';
import { NotificationType } from '@prisma/client';
import { DEFAULT_PROFILE_PICTURE } from 'src/users/constants';

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
export class NotificationProcessor {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly devicesRepository: DevicesRepository,
  ) {}

  async process(job: Job<{ notificationId: string; userId: string }>) {
    const { notificationId, userId } = job.data;

    const notification = await this.notificationsRepository.findByIdForPush(BigInt(notificationId));
    if (!notification) return;
    const devices = await this.devicesRepository.getUserDevices(BigInt(userId));
    if (!devices.length) return;

    const fcmData: FcmNotificationData = {
      id: notification.id.toString(),
      type: notification.type,
      isSeen: String(notification.seen),
      latestEventAt: notification.latestEventAt.toISOString(),
      actorSummary: JSON.stringify([
        {
          username: notification.actor.username,
          displayName: notification.actor.profile?.displayName,
          avatarUrl: notification.actor.profile?.avatarUrl || DEFAULT_PROFILE_PICTURE,
        },
      ]),
      tweetSubjectIds: JSON.stringify([notification.tweetId]),
    };

    //TODO: add proper title and body and localize
    const payload = {
      token: null,
      notification: {
        title: 'New Interaction',
        body: 'You have a new notification.',
      },
      data: fcmData as unknown as Record<string, string>,
      android: { priority: 'high' as const },
    };

    const tokens = devices.map((d) => d.fcmToken).filter((t): t is string => !!t);

    //TODO: use sendMulticast when available in firebase-admin also sendEach for list of messages when needed
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
        }
      });

      if (failedTokens.length > 0) {
        await this.devicesRepository.deleteDevicesByTokens(failedTokens);
      }
    }
  }
}
