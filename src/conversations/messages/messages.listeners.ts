import { OnEvent } from '@nestjs/event-emitter';
import { Injectable, Logger } from '@nestjs/common';
import { DOMAIN_EVENT_NAMES } from 'src/events/interfaces/event.interface';
import type { MessageCreatedEvent, ReactionSentEvent } from 'src/events/interfaces/event.interface';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
@Injectable()
export class MessageNotificationsListeners {
  private readonly logger = new Logger(MessageNotificationsListeners.name);
  constructor(@InjectQueue('messages-push') private readonly messagesPushQueue: Queue) {}

  @OnEvent(DOMAIN_EVENT_NAMES.Message_Created) async handleMessageCreated({
    actorId,
    conversationId,
    messagePreview,
    receiverId,
    hasMedia,
    mediaType,
  }: MessageCreatedEvent) {
    await this.messagesPushQueue.add(
      'sendMessagePush',
      {
        actorId: actorId.toString(),
        conversationId: conversationId.toString(),
        messagePreview,
        receiverId: receiverId.toString(),
        hasMedia,
        mediaType,
      },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        delay: 2000, // 2 second delay
        removeOnFail: false,
      },
    );
    this.logger.log(
      `Enqueued push message created job for message with conversationId ${conversationId} from user ${actorId} to user ${receiverId}`,
    );
  }

  @OnEvent(DOMAIN_EVENT_NAMES.Reaction_Created) async handleMessageReaction({
    actorId,
    conversationId,
    messagePreview,
    receiverId,
    reaction,
  }: ReactionSentEvent) {
    await this.messagesPushQueue.add(
      'sendMessagePush',
      {
        actorId: actorId.toString(),
        conversationId: conversationId.toString(),
        messagePreview,
        receiverId: receiverId.toString(),
        reaction,
      },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        delay: 2000, // 2 second delay
        removeOnFail: false,
      },
    );
    this.logger.log(
      `Enqueued push message reacted job for message with conversationId ${conversationId} from user ${actorId} to user ${receiverId}`,
    );
  }
}
