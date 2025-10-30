import { NotificationType } from '@prisma/client';

export class NotificationTriggerOptions {
  actorId: string;
  receiverId: string;
  type: NotificationType;
  tweetId?: string;
}
