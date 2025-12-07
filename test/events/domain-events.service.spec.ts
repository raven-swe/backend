import { Test, TestingModule } from '@nestjs/testing';
import { DomainEventsService } from 'src/events/domain-events.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DOMAIN_EVENT_NAMES,
  TweetCreatedEvent,
  TweetLikedEvent,
  TweetRetweetedEvent,
  UserFollowedEvent,
} from 'src/events/interfaces/event.interface';

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
      const payload: TweetLikedEvent = { tweetId: 1n, actorId: 2n, receiverId: 3n };
      await domainEventsService.emitTweetLiked(payload);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        DOMAIN_EVENT_NAMES.Tweet_Liked,
        payload,
      );
    });

    it('should emit UserFollowedEvent', async () => {
      const payload: UserFollowedEvent = { actorId: 1n, receiverId: 2n };
      await domainEventsService.emitUserFollowed(payload);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        DOMAIN_EVENT_NAMES.User_Followed,
        payload,
      );
    });

    it('should emit TweetRetweetedEvent', async () => {
      const payload: TweetRetweetedEvent = { tweetId: 1n, actorId: 3n, receiverId: 4n };
      await domainEventsService.emitTweetRetweeted(payload);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        DOMAIN_EVENT_NAMES.Tweet_Retweeted,
        payload,
      );
    });
    it('should emit TweetCreatedEvent', async () => {
      const payload: TweetCreatedEvent = {
        tweetId: 1n,
        authorId: 3n,
        replyToTweetId: null,
        quoteToTweetId: null,
        mentionedUserIds: [],
      };
      await domainEventsService.emitTweetCreated(payload);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        DOMAIN_EVENT_NAMES.Tweet_Created,
        payload,
      );
    });
  });
});
