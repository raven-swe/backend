import { Test, TestingModule } from '@nestjs/testing';
import { DomainEvents } from './domain-events';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DomainEvent,
  TweetCreatedEvent,
  TweetLikedEvent,
  TweetQuotedEvent,
  TweetRepliedEvent,
  TweetRetweetedEvent,
  UserFollowedEvent,
  UserMentionedEvent,
} from './interfaces/event.interface';

describe('DomainEvents', () => {
  let domainEvents: DomainEvents;
  const mockEventEmitter: jest.Mocked<Partial<EventEmitter2>> = {
    emitAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DomainEvents, { provide: EventEmitter2, useValue: mockEventEmitter }],
    }).compile();

    domainEvents = module.get<DomainEvents>(DomainEvents);
  });

  it('should be defined', () => {
    expect(domainEvents).toBeDefined();
  });

  describe('notifications events', () => {
    it('should emit TweetLikedEvent', async () => {
      const payload: TweetLikedEvent = { tweetId: '1', actorId: '2', receiverId: '3' };
      await domainEvents.emitTweetLiked(payload);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(DomainEvent.Tweet_Liked, payload);
    });

    it('should emit UserFollowedEvent', async () => {
      const payload: UserFollowedEvent = { actorId: '1', receiverId: '2' };
      await domainEvents.emitUserFollowed(payload);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(DomainEvent.User_Followed, payload);
    });

    it('should emit TweetRepliedEvent', async () => {
      const payload: TweetRepliedEvent = { tweetId: '1', actorId: '3', receiverId: '4' };
      await domainEvents.emitTweetReplied(payload);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(DomainEvent.Tweet_Replied, payload);
    });
    it('should emit TweetQuotedEvent', async () => {
      const payload: TweetQuotedEvent = { tweetId: '1', actorId: '3', receiverId: '4' };
      await domainEvents.emitTweetQuoted(payload);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(DomainEvent.Tweet_Quoted, payload);
    });
    it('should emit TweetRetweetedEvent', async () => {
      const payload: TweetRetweetedEvent = { tweetId: '1', actorId: '3', receiverId: '4' };
      await domainEvents.emitTweetRetweeted(payload);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(DomainEvent.Tweet_Retweeted, payload);
    });
    it('should emit TweetCreatedEvent', async () => {
      const payload: TweetCreatedEvent = { tweetId: '1', actorId: '3', receiverId: '4' };
      await domainEvents.emitTweetCreated(payload);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(DomainEvent.Tweet_Created, payload);
    });
    it('should emit UserMentionedEvent', async () => {
      const payload: UserMentionedEvent = { tweetId: '1', actorId: '3', receiverId: '4' };
      await domainEvents.emitUserMentioned(payload);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(DomainEvent.User_Mentioned, payload);
    });
  });
});
