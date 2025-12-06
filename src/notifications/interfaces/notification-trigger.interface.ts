import { NotificationType } from '@prisma/client';

export class NotificationTriggerOptions {
  actorId: bigint;
  receiverId: bigint;
  type: NotificationType;
  tweetId?: bigint;
}
