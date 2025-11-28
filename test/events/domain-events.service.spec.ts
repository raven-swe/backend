import { Test, TestingModule } from '@nestjs/testing';
import { DomainEventsService } from './domain-events.service';
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

describe('DomainEventsService', () => {
  let domainEventsService: DomainEventsService;
  const mockEventEmitter: jest.Mocked<Partial<EventEmitter2>> = {
    emitAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DomainEventsService, { provide: EventEmitter2, useValue: mockEventEmitter }],
    }).compile();

    domainEventsService = module.get<DomainEventsService>(DomainEventsService);
  });

  it('should be defined', () => {
    expect(domainEventsService).toBeDefined();
  });

  describe('notifications events', () => {
    it('should emit TweetLikedEvent', async () => {
      const payload: TweetLikedEvent = { tweetId: '1', actorId: '2', receiverId: '3' };
      await domainEventsService.emitTweetLiked(payload);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        DOMAIN_EVENT_NAMES.Tweet_Liked,
        payload,
      );
    });

    it('should emit UserFollowedEvent', async () => {
      const payload: UserFollowedEvent = { actorId: '1', receiverId: '2' };
      await domainEventsService.emitUserFollowed(payload);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        DOMAIN_EVENT_NAMES.User_Followed,
        payload,
      );
    });

    it('should emit TweetRepliedEvent', async () => {
      const payload: TweetRepliedEvent = { tweetId: '1', actorId: '3', receiverId: '4' };
      await domainEventsService.emitTweetReplied(payload);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        DOMAIN_EVENT_NAMES.Tweet_Replied,
        payload,
      );
    });
    it('should emit TweetQuotedEvent', async () => {
      const payload: TweetQuotedEvent = { tweetId: '1', actorId: '3', receiverId: '4' };
      await domainEventsService.emitTweetQuoted(payload);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        DOMAIN_EVENT_NAMES.Tweet_Quoted,
        payload,
      );
    });
    it('should emit TweetRetweetedEvent', async () => {
      const payload: TweetRetweetedEvent = { tweetId: '1', actorId: '3', receiverId: '4' };
      await domainEventsService.emitTweetRetweeted(payload);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        DOMAIN_EVENT_NAMES.Tweet_Retweeted,
        payload,
      );
    });
    it('should emit TweetCreatedEvent', async () => {
      const payload: TweetCreatedEvent = { tweetId: '1', actorId: '3', receiverId: '4' };
      await domainEventsService.emitTweetCreated(payload);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        DOMAIN_EVENT_NAMES.Tweet_Created,
        payload,
      );
    });
    it('should emit UserMentionedEvent', async () => {
      const payload: UserMentionedEvent = { tweetId: '1', actorId: '3', receiverId: '4' };
      await domainEventsService.emitUserMentioned(payload);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        DOMAIN_EVENT_NAMES.User_Mentioned,
        payload,
      );
    });
  });
});
