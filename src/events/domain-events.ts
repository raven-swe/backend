import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DomainEvent,
  TweetLikedEvent,
  TweetRepliedEvent,
  UserFollowedEvent,
} from './interfaces/event.interface';

@Injectable()
export class DomainEvents {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async emitTweetLiked(payload: TweetLikedEvent) {
    await this.eventEmitter.emitAsync(DomainEvent.Tweet_Liked, payload);
  }

  async emitUserFollowed(payload: UserFollowedEvent) {
    await this.eventEmitter.emitAsync(DomainEvent.User_Followed, payload);
  }

  async emitTweetReplied(payload: TweetRepliedEvent) {
    await this.eventEmitter.emitAsync(DomainEvent.Tweet_Replied, payload);
  }

  async emitTweetQuoted(payload: TweetRepliedEvent) {
    await this.eventEmitter.emitAsync(DomainEvent.Tweet_Quoted, payload);
  }

  async emitTweetRetweeted(payload: TweetRepliedEvent) {
    await this.eventEmitter.emitAsync(DomainEvent.Tweet_Retweeted, payload);
  }
  async emitTweetCreated(payload: TweetRepliedEvent) {
    await this.eventEmitter.emitAsync(DomainEvent.Tweet_Created, payload);
  }
  async emitUserMentioned(payload: TweetRepliedEvent) {
    await this.eventEmitter.emitAsync(DomainEvent.User_Mentioned, payload);
  }
}
