import { OnEvent } from '@nestjs/event-emitter';
import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { DOMAIN_EVENT_NAMES } from 'src/events/interfaces/event.interface';
import type {
  TweetLikedEvent,
  TweetCreatedEvent,
  TweetQuotedEvent,
  TweetRepliedEvent,
  TweetRetweetedEvent,
  UserFollowedEvent,
  UserMentionedEvent,
} from 'src/events/interfaces/event.interface';
@Injectable()
export class NotificationsListeners {
  private readonly logger = new Logger(NotificationsListeners.name);
  constructor(private readonly notificationsService: NotificationsService) {}
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
    await this.notificationsService.trigger({
      actorId: payload.actorId,
      receiverId: payload.receiverId,
      tweetId: payload.tweetId,
      type: 'LIKE',
    });
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
  @OnEvent(DOMAIN_EVENT_NAMES.Tweet_Replied) async handleTweetReplied(payload: TweetRepliedEvent) {
    try {
      await this.notificationsService.trigger({
        actorId: payload.actorId,
        receiverId: payload.receiverId,
        tweetId: payload.tweetId,
        type: 'REPLY',
      });
    } catch (error) {
      this.logger.error('Error processing Tweet_Replied event:', error);
    }
  }
  @OnEvent(DOMAIN_EVENT_NAMES.Tweet_Quoted) async handleTweetQuoted(payload: TweetQuotedEvent) {
    try {
      await this.notificationsService.trigger({
        actorId: payload.actorId,
        receiverId: payload.receiverId,
        tweetId: payload.tweetId,
        type: 'QUOTE',
      });
    } catch (error) {
      this.logger.error('Error processing Tweet_Quoted event:', error);
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
  @OnEvent(DOMAIN_EVENT_NAMES.User_Mentioned) async handleUserMentioned(
    payload: UserMentionedEvent,
  ) {
    try {
      await this.notificationsService.trigger({
        actorId: payload.actorId,
        receiverId: payload.receiverId,
        tweetId: payload.tweetId,
        type: 'MENTION',
      });
    } catch (error) {
      this.logger.error('Error processing User_Mentioned event:', error);
    }
  }
  @OnEvent(DOMAIN_EVENT_NAMES.Tweet_Created) async handleTweetCreated(payload: TweetCreatedEvent) {
    try {
      await this.notificationsService.trigger({
        actorId: payload.actorId,
        receiverId: payload.receiverId,
        tweetId: payload.tweetId,
        type: 'TWEET',
      });
    } catch (error) {
      this.logger.error('Error processing Tweet_Created event:', error);
    }
  }
}
