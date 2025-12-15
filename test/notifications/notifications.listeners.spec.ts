import { Test, TestingModule } from '@nestjs/testing';
import { TweetsRepository } from 'src/tweets/tweets.repository';
import { Logger } from '@nestjs/common';
import type {
  TweetLikedEvent,
  TweetCreatedEvent,
  TweetRetweetedEvent,
  TweetUnlikedEvent,
  UserUnfollowedEvent,
  TweetUnretweetedEvent,
  UserFollowedEvent,
  TweetDeleted,
} from 'src/events/interfaces/event.interface';
import { NotificationsListeners } from 'src/notifications/notifications.listeners';
import { NotificationsService } from 'src/notifications/notifications.service';

const mockNotificationsService = {
  trigger: jest.fn(),
  handleUndo: jest.fn(),
  handleTweetDeletionNotifications: jest.fn(),
};

const mockTweetRepository = {
  findTweetById: jest.fn(),
};

describe('NotificationsListeners', () => {
  let listeners: NotificationsListeners;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsListeners,
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: TweetsRepository, useValue: mockTweetRepository },
      ],
    }).compile();

    listeners = module.get<NotificationsListeners>(NotificationsListeners);

    loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(function (this: void) {});
  });

  describe('handleTweetLiked', () => {
    it('should trigger notification for tweet like', async () => {
      const payload: TweetLikedEvent = {
        actorId: 1n,
        receiverId: 2n,
        tweetId: 100n,
      };

      await listeners.handleTweetLiked(payload);

      expect(mockNotificationsService.trigger).toHaveBeenCalledWith({
        actorId: 1n,
        receiverId: 2n,
        tweetId: 100n,
        type: 'LIKE',
      });
    });

    it('should log error if trigger fails', async () => {
      const payload: TweetLikedEvent = {
        actorId: 1n,
        receiverId: 2n,
        tweetId: 100n,
      };

      const error = new Error('Trigger failed');
      mockNotificationsService.trigger.mockRejectedValueOnce(error);

      await listeners.handleTweetLiked(payload);

      expect(loggerErrorSpy).toHaveBeenCalledWith('Error processing Tweet_Liked event:', error);
    });
  });

  describe('handleUserFollowed', () => {
    it('should trigger notification for user follow', async () => {
      const payload: UserFollowedEvent = {
        actorId: 1n,
        receiverId: 2n,
      };

      await listeners.handleUserFollowed(payload);

      expect(mockNotificationsService.trigger).toHaveBeenCalledWith({
        actorId: 1n,
        receiverId: 2n,
        type: 'FOLLOW',
      });
    });

    it('should log error if trigger fails', async () => {
      const payload: UserFollowedEvent = {
        actorId: 1n,
        receiverId: 2n,
      };

      const error = new Error('Trigger failed');
      mockNotificationsService.trigger.mockRejectedValueOnce(error);

      await listeners.handleUserFollowed(payload);

      expect(loggerErrorSpy).toHaveBeenCalledWith('Error processing User_Followed event:', error);
    });
  });

  describe('handleTweetRetweeted', () => {
    it('should trigger notification for tweet retweet', async () => {
      const payload: TweetRetweetedEvent = {
        actorId: 1n,
        receiverId: 2n,
        tweetId: 100n,
      };

      await listeners.handleTweetRetweeted(payload);

      expect(mockNotificationsService.trigger).toHaveBeenCalledWith({
        actorId: 1n,
        receiverId: 2n,
        tweetId: 100n,
        type: 'RETWEET',
      });
    });

    it('should log error if trigger fails', async () => {
      const payload: TweetRetweetedEvent = {
        actorId: 1n,
        receiverId: 2n,
        tweetId: 100n,
      };

      const error = new Error('Trigger failed');
      mockNotificationsService.trigger.mockRejectedValueOnce(error);

      await listeners.handleTweetRetweeted(payload);

      expect(loggerErrorSpy).toHaveBeenCalledWith('Error processing Tweet_Retweeted event:', error);
    });
  });

  describe('handleTweetCreated', () => {
    it('should trigger REPLY notification when replying to a tweet', async () => {
      const payload: TweetCreatedEvent = {
        tweetId: 100n,
        authorId: 1n,
        replyToTweetId: 50n,
        quoteToTweetId: null,
        mentionedUserIds: [],
      };

      const parentTweet = { id: 50n, userId: 2n };
      mockTweetRepository.findTweetById.mockResolvedValueOnce(parentTweet);

      await listeners.handleTweetCreated(payload);

      expect(mockTweetRepository.findTweetById).toHaveBeenCalledWith(50n);
      expect(mockNotificationsService.trigger).toHaveBeenCalledWith({
        type: 'REPLY',
        actorId: 1n,
        receiverId: 2n,
        tweetId: 100n,
      });
    });

    it('should not trigger REPLY notification when replying to own tweet', async () => {
      const payload: TweetCreatedEvent = {
        tweetId: 100n,
        authorId: 1n,
        replyToTweetId: 50n,
        quoteToTweetId: null,
        mentionedUserIds: [],
      };

      const parentTweet = { id: 50n, userId: 1n };
      mockTweetRepository.findTweetById.mockResolvedValueOnce(parentTweet);

      await listeners.handleTweetCreated(payload);

      expect(mockNotificationsService.trigger).not.toHaveBeenCalled();
    });

    it('should not trigger REPLY notification when parent tweet not found', async () => {
      const payload: TweetCreatedEvent = {
        tweetId: 100n,
        authorId: 1n,
        replyToTweetId: 50n,
        quoteToTweetId: null,
        mentionedUserIds: [],
      };

      mockTweetRepository.findTweetById.mockResolvedValueOnce(null);

      await listeners.handleTweetCreated(payload);

      expect(mockNotificationsService.trigger).not.toHaveBeenCalled();
    });

    it('should trigger QUOTE notification when quoting a tweet', async () => {
      const payload: TweetCreatedEvent = {
        tweetId: 100n,
        authorId: 1n,
        replyToTweetId: null,
        quoteToTweetId: 50n,
        mentionedUserIds: [],
      };

      const quotedTweet = { id: 50n, userId: 2n };
      mockTweetRepository.findTweetById.mockResolvedValueOnce(quotedTweet);

      await listeners.handleTweetCreated(payload);

      expect(mockTweetRepository.findTweetById).toHaveBeenCalledWith(50n);
      expect(mockNotificationsService.trigger).toHaveBeenCalledWith({
        type: 'QUOTE',
        actorId: 1n,
        receiverId: 2n,
        tweetId: 100n,
      });
    });

    it('should not trigger QUOTE notification when quoting own tweet', async () => {
      const payload: TweetCreatedEvent = {
        tweetId: 100n,
        authorId: 1n,
        replyToTweetId: null,
        quoteToTweetId: 50n,
        mentionedUserIds: [],
      };

      const quotedTweet = { id: 50n, userId: 1n };
      mockTweetRepository.findTweetById.mockResolvedValueOnce(quotedTweet);

      await listeners.handleTweetCreated(payload);

      expect(mockNotificationsService.trigger).not.toHaveBeenCalled();
    });

    it('should trigger MENTION notifications for mentioned users', async () => {
      const payload: TweetCreatedEvent = {
        tweetId: 100n,
        authorId: 1n,
        replyToTweetId: null,
        quoteToTweetId: null,
        mentionedUserIds: [2n, 3n, 4n],
      };

      await listeners.handleTweetCreated(payload);

      expect(mockNotificationsService.trigger).toHaveBeenCalledTimes(3);
      expect(mockNotificationsService.trigger).toHaveBeenCalledWith({
        type: 'MENTION',
        actorId: 1n,
        receiverId: 2n,
        tweetId: 100n,
      });
      expect(mockNotificationsService.trigger).toHaveBeenCalledWith({
        type: 'MENTION',
        actorId: 1n,
        receiverId: 3n,
        tweetId: 100n,
      });
      expect(mockNotificationsService.trigger).toHaveBeenCalledWith({
        type: 'MENTION',
        actorId: 1n,
        receiverId: 4n,
        tweetId: 100n,
      });
    });

    it('should skip mention notification for author', async () => {
      const payload: TweetCreatedEvent = {
        tweetId: 100n,
        authorId: 1n,
        replyToTweetId: null,
        quoteToTweetId: null,
        mentionedUserIds: [1n, 2n],
      };

      await listeners.handleTweetCreated(payload);

      expect(mockNotificationsService.trigger).toHaveBeenCalledTimes(1);
      expect(mockNotificationsService.trigger).toHaveBeenCalledWith({
        type: 'MENTION',
        actorId: 1n,
        receiverId: 2n,
        tweetId: 100n,
      });
    });

    it('should avoid duplicate notifications when replying to a mentioned user', async () => {
      const payload: TweetCreatedEvent = {
        tweetId: 100n,
        authorId: 1n,
        replyToTweetId: 50n,
        quoteToTweetId: null,
        mentionedUserIds: [2n, 3n],
      };

      const parentTweet = { id: 50n, userId: 2n };
      mockTweetRepository.findTweetById.mockResolvedValueOnce(parentTweet);

      await listeners.handleTweetCreated(payload);

      expect(mockNotificationsService.trigger).toHaveBeenCalledTimes(2);
      // User 2 should only get REPLY notification, not MENTION
      expect(mockNotificationsService.trigger).toHaveBeenCalledWith({
        type: 'REPLY',
        actorId: 1n,
        receiverId: 2n,
        tweetId: 100n,
      });
      // User 3 should get MENTION notification
      expect(mockNotificationsService.trigger).toHaveBeenCalledWith({
        type: 'MENTION',
        actorId: 1n,
        receiverId: 3n,
        tweetId: 100n,
      });
    });

    it('should avoid duplicate notifications when quoting a mentioned user', async () => {
      const payload: TweetCreatedEvent = {
        tweetId: 100n,
        authorId: 1n,
        replyToTweetId: null,
        quoteToTweetId: 50n,
        mentionedUserIds: [2n, 3n],
      };

      const quotedTweet = { id: 50n, userId: 2n };
      mockTweetRepository.findTweetById.mockResolvedValueOnce(quotedTweet);

      await listeners.handleTweetCreated(payload);

      expect(mockNotificationsService.trigger).toHaveBeenCalledTimes(2);
      // User 2 should only get QUOTE notification, not MENTION
      expect(mockNotificationsService.trigger).toHaveBeenCalledWith({
        type: 'QUOTE',
        actorId: 1n,
        receiverId: 2n,
        tweetId: 100n,
      });
      // User 3 should get MENTION notification
      expect(mockNotificationsService.trigger).toHaveBeenCalledWith({
        type: 'MENTION',
        actorId: 1n,
        receiverId: 3n,
        tweetId: 100n,
      });
    });

    it('should handle both reply and quote with mentions', async () => {
      const payload: TweetCreatedEvent = {
        tweetId: 100n,
        authorId: 1n,
        replyToTweetId: 50n,
        quoteToTweetId: 60n,
        mentionedUserIds: [2n, 3n, 4n, 5n],
      };

      const parentTweet = { id: 50n, userId: 2n };
      const quotedTweet = { id: 60n, userId: 3n };
      mockTweetRepository.findTweetById
        .mockResolvedValueOnce(parentTweet)
        .mockResolvedValueOnce(quotedTweet);

      await listeners.handleTweetCreated(payload);

      expect(mockNotificationsService.trigger).toHaveBeenCalledTimes(4);
      expect(mockNotificationsService.trigger).toHaveBeenCalledWith({
        type: 'REPLY',
        actorId: 1n,
        receiverId: 2n,
        tweetId: 100n,
      });
      expect(mockNotificationsService.trigger).toHaveBeenCalledWith({
        type: 'QUOTE',
        actorId: 1n,
        receiverId: 3n,
        tweetId: 100n,
      });
      // Users 4 and 5 should get MENTION notifications
      expect(mockNotificationsService.trigger).toHaveBeenCalledWith({
        type: 'MENTION',
        actorId: 1n,
        receiverId: 4n,
        tweetId: 100n,
      });
      expect(mockNotificationsService.trigger).toHaveBeenCalledWith({
        type: 'MENTION',
        actorId: 1n,
        receiverId: 5n,
        tweetId: 100n,
      });
    });

    it('should log error if processing fails', async () => {
      const payload: TweetCreatedEvent = {
        tweetId: 100n,
        authorId: 1n,
        replyToTweetId: 50n,
        quoteToTweetId: null,
        mentionedUserIds: [],
      };

      const error = new Error('Database error');
      mockTweetRepository.findTweetById.mockRejectedValueOnce(error);

      await listeners.handleTweetCreated(payload);

      expect(loggerErrorSpy).toHaveBeenCalledWith('Error processing Tweet_Created event:', error);
    });
  });

  describe('handleTweetUnliked', () => {
    it('should handle undo for tweet unlike', async () => {
      const payload: TweetUnlikedEvent = {
        actorId: 1n,
        receiverId: 2n,
        tweetId: 100n,
      };

      await listeners.handleTweetUnliked(payload);

      expect(mockNotificationsService.handleUndo).toHaveBeenCalledWith({
        actorId: 1n,
        receiverId: 2n,
        tweetId: 100n,
        type: 'LIKE',
      });
    });

    it('should log error if handleUndo fails', async () => {
      const payload: TweetUnlikedEvent = {
        actorId: 1n,
        receiverId: 2n,
        tweetId: 100n,
      };

      const error = new Error('Undo failed');
      mockNotificationsService.handleUndo.mockRejectedValueOnce(error);

      await listeners.handleTweetUnliked(payload);

      expect(loggerErrorSpy).toHaveBeenCalledWith('Error processing Tweet_Unliked event:', error);
    });
  });

  describe('handleUserUnfollowed', () => {
    it('should handle undo for user unfollow', async () => {
      const payload: UserUnfollowedEvent = {
        actorId: 1n,
        receiverId: 2n,
      };

      await listeners.handleUserUnfollowed(payload);

      expect(mockNotificationsService.handleUndo).toHaveBeenCalledWith({
        actorId: 1n,
        receiverId: 2n,
        type: 'FOLLOW',
      });
    });

    it('should log error if handleUndo fails', async () => {
      const payload: UserUnfollowedEvent = {
        actorId: 1n,
        receiverId: 2n,
      };

      const error = new Error('Undo failed');
      mockNotificationsService.handleUndo.mockRejectedValueOnce(error);

      await listeners.handleUserUnfollowed(payload);

      expect(loggerErrorSpy).toHaveBeenCalledWith('Error processing User_Unfollowed event:', error);
    });
  });

  describe('handleTweetUnRetweeted', () => {
    it('should handle undo for tweet unretweet', async () => {
      const payload: TweetUnretweetedEvent = {
        actorId: 1n,
        receiverId: 2n,
        tweetId: 100n,
      };

      await listeners.handleTweetUnRetweeted(payload);

      expect(mockNotificationsService.handleUndo).toHaveBeenCalledWith({
        actorId: 1n,
        receiverId: 2n,
        tweetId: 100n,
        type: 'RETWEET',
      });
    });

    it('should log error if handleUndo fails', async () => {
      const payload: TweetUnretweetedEvent = {
        actorId: 1n,
        receiverId: 2n,
        tweetId: 100n,
      };

      const error = new Error('Undo failed');
      mockNotificationsService.handleUndo.mockRejectedValueOnce(error);

      await listeners.handleTweetUnRetweeted(payload);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Error processing Tweet_Unretweeted event:',
        error,
      );
    });
  });

  describe('handleTweetDeleted', () => {
    it('should handle tweet deletion notifications', async () => {
      const payload: TweetDeleted = {
        receivers: [
          { receiverId: 1n, unseenCount: 2 },
          { receiverId: 2n, unseenCount: 3 },
          { receiverId: 3n, unseenCount: 4 },
        ],
      };
      await listeners.handleTweetDeleted(payload);

      expect(mockNotificationsService.handleTweetDeletionNotifications).toHaveBeenCalledWith([
        { receiverId: 1n, unseenCount: 2 },
        { receiverId: 2n, unseenCount: 3 },
        { receiverId: 3n, unseenCount: 4 },
      ]);
    });

    it('should log error if handling deletion fails', async () => {
      const payload: TweetDeleted = {
        receivers: [
          { receiverId: 1n, unseenCount: 2 },
          { receiverId: 2n, unseenCount: 3 },
          { receiverId: 3n, unseenCount: 4 },
        ],
      };

      const error = new Error('Deletion handling failed');
      mockNotificationsService.handleTweetDeletionNotifications.mockRejectedValueOnce(error);

      await listeners.handleTweetDeleted(payload);

      expect(loggerErrorSpy).toHaveBeenCalledWith('Error processing Tweet_Deleted event:', error);
    });
  });
});
