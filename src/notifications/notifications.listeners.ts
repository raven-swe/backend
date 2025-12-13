import { OnEvent } from '@nestjs/event-emitter';
import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { DOMAIN_EVENT_NAMES } from 'src/events/interfaces/event.interface';
import type {
  TweetLikedEvent,
  TweetCreatedEvent,
  TweetRetweetedEvent,
  UserFollowedEvent,
} from 'src/events/interfaces/event.interface';
import { TweetsRepository } from 'src/tweets/tweets.repository';
@Injectable()
export class NotificationsListeners {
  private readonly logger = new Logger(NotificationsListeners.name);
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly tweetRepository: TweetsRepository,
  ) {}

  @OnEvent(DOMAIN_EVENT_NAMES.Tweet_Liked) async handleTweetLiked(payload: TweetLikedEvent) {
    try {
      await this.notificationsService.trigger({
        actorId: payload.actorId,
        receiverId: payload.receiverId,
        tweetId: payload.tweetId,
        type: 'LIKE',
      });
    } catch (error) {
      this.logger.error('Error processing Tweet_Liked event:', error);
    }
  }

  @OnEvent(DOMAIN_EVENT_NAMES.User_Followed) async handleUserFollowed(payload: UserFollowedEvent) {
    try {
      await this.notificationsService.trigger({
        actorId: payload.actorId,
        receiverId: payload.receiverId,
        type: 'FOLLOW',
      });
    } catch (error) {
      this.logger.error('Error processing User_Followed event:', error);
    }
  }
  @OnEvent(DOMAIN_EVENT_NAMES.Tweet_Retweeted) async handleTweetRetweeted(
    payload: TweetRetweetedEvent,
  ) {
    try {
      await this.notificationsService.trigger({
        actorId: payload.actorId,
        receiverId: payload.receiverId,
        tweetId: payload.tweetId,
        type: 'RETWEET',
      });
    } catch (error) {
      this.logger.error('Error processing Tweet_Retweeted event:', error);
    }
  }
  @OnEvent(DOMAIN_EVENT_NAMES.Tweet_Created) async handleTweetCreated(payload: TweetCreatedEvent) {
    const { tweetId, authorId, replyToTweetId, quoteToTweetId, mentionedUserIds } = payload;

    const authorsIdsNotified = new Set<bigint>();

    try {
      if (replyToTweetId) {
        const parentTweet = await this.tweetRepository.findTweetById(replyToTweetId);

        if (parentTweet && parentTweet.userId !== authorId) {
          authorsIdsNotified.add(parentTweet.userId);
          await this.notificationsService.trigger({
            type: 'REPLY',
            actorId: authorId,
            receiverId: parentTweet.userId,
            tweetId: tweetId,
          });
        }
      }
      if (quoteToTweetId) {
        const quotedTweet = await this.tweetRepository.findTweetById(quoteToTweetId);

        if (quotedTweet && quotedTweet.userId !== authorId) {
          authorsIdsNotified.add(quotedTweet.userId);
          await this.notificationsService.trigger({
            type: 'QUOTE',
            actorId: authorId,
            receiverId: quotedTweet.userId,
            tweetId: tweetId,
          });
        }
      }

      if (mentionedUserIds.length > 0) {
        for (const targetId of mentionedUserIds) {
          if (targetId === authorId) continue;

          // Avoid sending duplicate notifications to users already notified for reply or quote
          if (authorsIdsNotified.has(targetId)) continue;

          authorsIdsNotified.add(targetId);
          await this.notificationsService.trigger({
            type: 'MENTION',
            actorId: authorId,
            receiverId: targetId,
            tweetId: tweetId,
          });
        }
      }
    } catch (error) {
      this.logger.error('Error processing Tweet_Created event:', error);
    }
  }
}
