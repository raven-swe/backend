import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PushSenderService } from 'src/firebase/push-sender.service';
import { UsersRepository } from 'src/users/users.repository';
import { DEFAULT_PROFILE_PICTURE } from 'src/users/constants';
import { MediaType } from '@prisma/client';
import { buildFcmNotificationText } from 'src/notifications/utils/fcm-notification-body-builder';
import { MediaUrlService } from 'src/common/media-url';

@Processor('messages-push')
export class MessagesPushProcessor extends WorkerHost {
  private readonly logger = new Logger(MessagesPushProcessor.name);

  constructor(
    private readonly pushSender: PushSenderService,
    private readonly usersRepository: UsersRepository,
    private readonly mediaUrlService: MediaUrlService,
  ) {
    super();
  }

  async process(
    job: Job<{
      actorId: string;
      conversationId: string;
      messagePreview: string;
      receiverId: string;
      hasMedia?: boolean;
      mediaType?: MediaType | null;
      reaction?: string | null;
    }>,
  ) {
    const { messagePreview, receiverId, actorId, conversationId, reaction, hasMedia, mediaType } =
      job.data;
    this.logger.log(
      `Processing push message job for conversation id ${conversationId} to user ${receiverId}`,
    );

    try {
      const actorsMetadata = await this.usersRepository.getUsersMetadataById([BigInt(actorId)]);
      const actorMetadata = actorsMetadata[0];
      if (!actorMetadata) {
        this.logger.warn(`Actor with id ${actorId} not found, skipping push notification`);
        return;
      }

      const languageCode = await this.usersRepository.getUserLocale(BigInt(receiverId));

      const { title, body } = buildFcmNotificationText({
        notificationType: 'MESSAGE',
        previewActors: [actorMetadata.profile?.displayName || actorMetadata.username],
        tweetSnippet: messagePreview,
        locale: languageCode,
        reaction,
        hasMedia,
        mediaType,
      });

      const actorAvatarUrl = this.mediaUrlService.toAbsolute(
        actorMetadata.profile?.avatarUrl || DEFAULT_PROFILE_PICTURE,
      );

      const fcmData = {
        actorSummary: JSON.stringify([
          {
            username: actorMetadata.username,
            displayName: actorMetadata.profile?.displayName,
            avatarUrl: actorAvatarUrl,
          },
        ]),
        messageSummary: JSON.stringify({
          messagePreview,
          conversationId: conversationId.toString(),
        }),
      };

      const payload = {
        token: null,
        notification: {
          title,
          body: body ?? undefined,
          image: actorAvatarUrl,
        },
        data: fcmData as unknown as Record<string, string>,
        android: {
          priority: 'high' as const,
          notification: {
            channel_id: 'messages',
            sound: 'default',
            color: '#e5e7ff',
            tag: `msg:${conversationId}`,
          },
        },
      };

      this.logger.debug(`FCM Payload: ${JSON.stringify(payload)}`);

      await this.pushSender.sendToDevices(receiverId, payload);
    } catch (err) {
      this.logger.error(
        `Error processing push notification for message to user ${receiverId}`,
        err,
      );
    }
  }
}
