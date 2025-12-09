import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DOMAIN_EVENT_NAMES,
  MessageCreatedEvent,
  ReactionSentEvent,
  TweetCreatedEvent,
  TweetLikedEvent,
  TweetRetweetedEvent,
  TweetUnlikedEvent,
  TweetUnretweetedEvent,
  UserFollowedEvent,
  UserUnfollowedEvent,
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

  async emitTweetRetweeted(payload: TweetRetweetedEvent) {
    await this.eventEmitter.emitAsync(DOMAIN_EVENT_NAMES.Tweet_Retweeted, payload);
  }

  async emitTweetCreated(payload: TweetCreatedEvent) {
    await this.eventEmitter.emitAsync(DOMAIN_EVENT_NAMES.Tweet_Created, payload);
  }

  async emitTweetUnliked(payload: TweetUnlikedEvent) {
    await this.eventEmitter.emitAsync(DOMAIN_EVENT_NAMES.Tweet_Unliked, payload);
  }

  async emitTweetUnretweeted(payload: TweetUnretweetedEvent) {
    await this.eventEmitter.emitAsync(DOMAIN_EVENT_NAMES.Tweet_Unretweeted, payload);
  }

  async emitUserUnfollowed(payload: UserUnfollowedEvent) {
    await this.eventEmitter.emitAsync(DOMAIN_EVENT_NAMES.User_Unfollowed, payload);
  }

  async emitMessageCreated(payload: MessageCreatedEvent) {
    await this.eventEmitter.emitAsync(DOMAIN_EVENT_NAMES.Message_Created, payload);
  }

  async emitReactionSent(payload: ReactionSentEvent) {
    await this.eventEmitter.emitAsync(DOMAIN_EVENT_NAMES.Reaction_Created, payload);
  }
}
