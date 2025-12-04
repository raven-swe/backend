import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DOMAIN_EVENT_NAMES,
  TweetCreatedEvent,
  TweetLikedEvent,
  TweetQuotedEvent,
  TweetRepliedEvent,
  TweetRetweetedEvent,
  UserFollowedEvent,
  UserMentionedEvent,
} from './interfaces/event.interface';

@Injectable()
export class DomainEventsService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async emitTweetLiked(payload: TweetLikedEvent) {
    await this.eventEmitter.emitAsync(DOMAIN_EVENT_NAMES.Tweet_Liked, payload);
  }

  async emitUserFollowed(payload: UserFollowedEvent) {
    await this.eventEmitter.emitAsync(DOMAIN_EVENT_NAMES.User_Followed, payload);
  }

  async emitTweetReplied(payload: TweetRepliedEvent) {
    await this.eventEmitter.emitAsync(DOMAIN_EVENT_NAMES.Tweet_Replied, payload);
  }

  async emitTweetQuoted(payload: TweetQuotedEvent) {
    await this.eventEmitter.emitAsync(DOMAIN_EVENT_NAMES.Tweet_Quoted, payload);
  }

  async emitTweetRetweeted(payload: TweetRetweetedEvent) {
    await this.eventEmitter.emitAsync(DOMAIN_EVENT_NAMES.Tweet_Retweeted, payload);
  }
  async emitTweetCreated(payload: TweetCreatedEvent) {
    await this.eventEmitter.emitAsync(DOMAIN_EVENT_NAMES.Tweet_Created, payload);
  }
  async emitUserMentioned(payload: UserMentionedEvent) {
    await this.eventEmitter.emitAsync(DOMAIN_EVENT_NAMES.User_Mentioned, payload);
  }
}
