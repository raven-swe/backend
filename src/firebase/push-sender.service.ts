import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { DevicesRepository } from 'src/devices/devices.repository';

@Injectable()
export class PushSenderService {
  private readonly logger = new Logger(PushSenderService.name);

  constructor(private readonly devicesRepository: DevicesRepository) {}

  async sendToDevices(userId: string, payload: Omit<admin.messaging.MulticastMessage, 'tokens'>) {
    const devices = await this.devicesRepository.getUserDevices(BigInt(userId));
    if (!devices.length) {
      this.logger.warn(`No devices found for user ${userId}, skipping push notification`);
      return;
    }

    this.logger.log(`Found ${devices.length} devices for user ${userId}`);

    try {
      const tokens = devices.map((d) => d.fcmToken).filter((t): t is string => !!t);
      if (!tokens.length) return;

      const response = await admin.messaging().sendEachForMulticast({
        tokens,
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
          this.logger.log(`Deleted ${failedTokens.length} invalid tokens for user ${userId}`);
        }
      }
    } catch (err) {
      this.logger.error(`Error sending push to user ${userId}`, err);
    }
  }
}
