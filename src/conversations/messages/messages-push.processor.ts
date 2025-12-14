import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { DevicesRepository } from 'src/devices/devices.repository';
import { PushSenderService } from 'src/firebase/push-sender.service';
import { UsersRepository } from 'src/users/users.repository';
import { DEFAULT_PROFILE_PICTURE } from 'src/users/constants';

@Processor('messages-push')
export class MessagesPushProcessor extends WorkerHost {
  private readonly logger = new Logger(MessagesPushProcessor.name);

  constructor(
    private readonly devicesRepository: DevicesRepository,
    private readonly pushSender: PushSenderService,
    private readonly usersRepository: UsersRepository,
  ) {
    super();
  }

  async process(
    job: Job<{
      messagePreview: string;
      receiverId: string;
      actorId: string;
      conversationId: string;
    }>,
  ) {
    const { messagePreview, receiverId, actorId, conversationId } = job.data;

    try {
      const devices = await this.devicesRepository.getUserDevices(BigInt(receiverId));
      if (!devices.length) return;

      const actorMetadata = await this.usersRepository.getUserMetaDataById(BigInt(actorId));
      if (!actorMetadata) {
        this.logger.warn(`Actor with id ${actorId} not found, skipping push notification`);
        return;
      }

      const payload = {
        notification: {
          title: actorMetadata.profile!.displayName || actorMetadata.username,
          body: messagePreview,
          image: actorMetadata.profile?.avatarUrl || DEFAULT_PROFILE_PICTURE,
        },
        data: {
          type: 'MESSAGE',
          actorSummary: JSON.stringify([
            {
              username: actorMetadata.username,
              displayName: actorMetadata.profile?.displayName,
              avatarUrl: actorMetadata.profile?.avatarUrl || DEFAULT_PROFILE_PICTURE,
            },
          ]),
          messageSummary: JSON.stringify({
            messagePreview,
            conversationId: conversationId.toString(),
          }),
        },
        android: {
          priority: 'high' as const,
          notification: {
            channel_id: 'messages',
            tag: `msg:${conversationId}`,
            sound: 'default',
            color: '#e5e7ff',
          },
        },
      };

      await this.pushSender.sendToDevices(receiverId, payload);
    } catch (err) {
      this.logger.error(
        `Error processing push notification for message to user ${receiverId}`,
        err,
      );
    }
  }
}
