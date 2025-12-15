import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { NotificationProcessor } from './notifications.processor';
import { NotificationsRepository } from './notifications.repository';
import { UsersRepository } from 'src/users/users.repository';
import { PushSenderService } from 'src/firebase/push-sender.service';
import { NotificationType, LanguageCode } from '@prisma/client';
import { Logger } from '@nestjs/common';
import * as fcmBuilder from './utils/fcm-notification-body-builder';
import { DEFAULT_PROFILE_PICTURE } from 'src/users/constants';

describe('NotificationProcessor', () => {
  let processor: NotificationProcessor;
  let notificationsRepository: jest.Mocked<NotificationsRepository>;
  let usersRepository: jest.Mocked<UsersRepository>;
  let pushService: jest.Mocked<PushSenderService>;

  const mockNotificationsRepository = {
    findByIdForPush: jest.fn(),
  };

  const mockUsersRepository = {
    getUserLocale: jest.fn(),
  };

  const mockPushService = {
    sendToDevices: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationProcessor,
        { provide: NotificationsRepository, useValue: mockNotificationsRepository },
        { provide: UsersRepository, useValue: mockUsersRepository },
        { provide: PushSenderService, useValue: mockPushService },
      ],
    }).compile();

    processor = module.get<NotificationProcessor>(NotificationProcessor);
    notificationsRepository = module.get(NotificationsRepository);
    usersRepository = module.get(UsersRepository);
    pushService = module.get(PushSenderService);
  });

  const createMockJob = (notificationId: string, userId: string): Job => {
    return {
      data: { notificationId, userId },
    } as Job;
  };

  describe('process', () => {
    it('should skip push notification when notification is not found', async () => {
      const job = createMockJob('999', '10');

      mockNotificationsRepository.findByIdForPush.mockResolvedValue(null);

      await processor.process(job);

      expect(notificationsRepository.findByIdForPush).toHaveBeenCalledWith(BigInt(999), BigInt(10));
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Notification with id 999 not found, skipping push notification',
      );
      expect(pushService.sendToDevices).not.toHaveBeenCalled();
    });

    it('should process LIKE notification and send push', async () => {
      const job = createMockJob('1', '10');

      const notification = {
        id: BigInt(1),
        type: NotificationType.LIKE,
        isAggregated: false,
        seen: false,
        latestEventAt: new Date('2024-01-01T10:00:00Z'),
        dedupeKey: 'LIKE:TWEET:100',
        actor: {
          id: BigInt(2),
          username: 'alice',
          profile: {
            displayName: 'Alice',
            avatarUrl: 'http://example.com/alice.jpg',
          },
          followers: [],
        },
        tweet: {
          id: BigInt(100),
          content: 'Test tweet content',
        },
        payload: {
          actorsIds: ['2'],
          actorsPreview: [],
        },
      };

      mockNotificationsRepository.findByIdForPush.mockResolvedValue(notification);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'alice liked your tweet',
        body: 'Test tweet content',
      });

      await processor.process(job);

      expect(notificationsRepository.findByIdForPush).toHaveBeenCalledWith(BigInt(1), BigInt(10));
      expect(usersRepository.getUserLocale).toHaveBeenCalledWith(BigInt(10));
      expect(fcmBuilder.buildFcmNotificationText).toHaveBeenCalledWith({
        notificationType: NotificationType.LIKE,
        isAggregated: false,
        previewActors: ['Alice'],
        totalActorCount: 1,
        tweetSnippet: 'Test tweet content',
        locale: LanguageCode.EN,
      });

      expect(pushService.sendToDevices).toHaveBeenCalledWith(
        '10',
        expect.objectContaining({
          token: null,
          notification: {
            title: 'alice liked your tweet',
            body: 'Test tweet content',
            image: 'http://example.com/alice.jpg',
          },
          data: expect.objectContaining({
            id: '1',
            type: NotificationType.LIKE,
            isSeen: 'false',
            latestEventAt: '2024-01-01T10:00:00.000Z',
          }),
          android: {
            priority: 'normal',
            notification: {
              channel_id: 'default',
              sound: 'default',
              color: '#e5e7ff',
              tag: 'LIKE:TWEET:100',
            },
          },
        }),
      );
    });

    it('should process aggregated LIKE notification with multiple actors', async () => {
      const job = createMockJob('2', '10');

      const notification = {
        id: BigInt(2),
        type: NotificationType.LIKE,
        isAggregated: true,
        seen: false,
        latestEventAt: new Date('2024-01-01T10:00:00Z'),
        dedupeKey: 'LIKE:TWEET:100',
        actor: {
          id: BigInt(2),
          username: 'alice',
          profile: {
            displayName: 'Alice',
            avatarUrl: 'http://example.com/alice.jpg',
          },
          followers: [],
        },
        tweet: {
          id: BigInt(100),
          content: 'Test tweet',
        },
        payload: {
          actorsIds: ['2', '3', '4'],
          actorsPreview: [
            {
              id: '3',
              username: 'bob',
              displayName: 'Bob',
              avatarUrl: 'http://example.com/bob.jpg',
              ifFollowing: true,
            },
            {
              id: '4',
              username: 'charlie',
              displayName: null,
              avatarUrl: null,
              ifFollowing: false,
            },
          ],
        },
      };

      mockNotificationsRepository.findByIdForPush.mockResolvedValue(notification);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'Alice and 2 others liked your tweet',
        body: undefined,
      });

      await processor.process(job);

      expect(fcmBuilder.buildFcmNotificationText).toHaveBeenCalledWith({
        notificationType: NotificationType.LIKE,
        isAggregated: true,
        previewActors: ['Alice', 'Bob', 'charlie'],
        totalActorCount: 3,
        tweetSnippet: 'Test tweet',
        locale: LanguageCode.EN,
      });

      const call = pushService.sendToDevices.mock.calls[0];
      const payload = call[1];

      expect(payload.notification.title).toBe('Alice and 2 others liked your tweet');
      expect(payload.notification.body).toBeUndefined();

      const actorSummary = JSON.parse(payload.data.actorSummary);
      expect(actorSummary).toHaveLength(3);
      expect(actorSummary[0]).toEqual({
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: 'http://example.com/alice.jpg',
        isFollowing: false,
      });
      expect(actorSummary[2]).toEqual({
        username: 'charlie',
        displayName: undefined,
        avatarUrl: DEFAULT_PROFILE_PICTURE,
        isFollowing: false,
      });
    });

    it('should process FOLLOW notification', async () => {
      const job = createMockJob('3', '10');

      const notification = {
        id: BigInt(3),
        type: NotificationType.FOLLOW,
        isAggregated: false,
        seen: false,
        latestEventAt: new Date('2024-01-01T10:00:00Z'),
        dedupeKey: 'FOLLOW:USER:10',
        actor: {
          id: BigInt(5),
          username: 'newFollower',
          profile: {
            displayName: 'New Follower',
            avatarUrl: 'http://example.com/follower.jpg',
          },
          followers: [],
        },
        tweet: null,
        payload: {
          actorsIds: ['5'],
          actorsPreview: [],
        },
      };

      mockNotificationsRepository.findByIdForPush.mockResolvedValue(notification);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'New Follower followed you',
        body: undefined,
      });

      await processor.process(job);

      expect(fcmBuilder.buildFcmNotificationText).toHaveBeenCalledWith({
        notificationType: NotificationType.FOLLOW,
        isAggregated: false,
        previewActors: ['New Follower'],
        totalActorCount: 1,
        tweetSnippet: null,
        locale: LanguageCode.EN,
      });

      expect(pushService.sendToDevices).toHaveBeenCalled();
    });

    it('should process REPLY notification with tweet content', async () => {
      const job = createMockJob('4', '10');

      const notification = {
        id: BigInt(4),
        type: NotificationType.REPLY,
        isAggregated: false,
        seen: true,
        latestEventAt: new Date('2024-01-02T15:30:00Z'),
        dedupeKey: null,
        actor: {
          id: BigInt(6),
          username: 'replier',
          profile: {
            displayName: null,
            avatarUrl: null,
          },
          followers: [{ followerId: BigInt(10) }],
        },
        tweet: {
          id: BigInt(200),
          content: 'This is a reply to your tweet',
        },
        payload: {
          actorsIds: ['6'],
          actorsPreview: [],
        },
      };

      mockNotificationsRepository.findByIdForPush.mockResolvedValue(notification);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.AR);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'replier رد: "This is a reply to your tweet"',
        body: 'This is a reply to your tweet',
      });

      await processor.process(job);

      expect(usersRepository.getUserLocale).toHaveBeenCalledWith(BigInt(10));
      expect(fcmBuilder.buildFcmNotificationText).toHaveBeenCalledWith({
        notificationType: NotificationType.REPLY,
        isAggregated: false,
        previewActors: ['replier'],
        totalActorCount: 1,
        tweetSnippet: 'This is a reply to your tweet',
        locale: LanguageCode.AR,
      });

      const call = pushService.sendToDevices.mock.calls[0];
      const payload = call[1];

      expect(payload.data.isSeen).toBe('true');
      expect(payload.android.notification.tag).toBeUndefined();
      expect(payload.notification.image).toBe(DEFAULT_PROFILE_PICTURE);
    });

    it('should handle notification with null payload gracefully', async () => {
      const job = createMockJob('5', '10');

      const notification = {
        id: BigInt(5),
        type: NotificationType.MENTION,
        isAggregated: false,
        seen: false,
        latestEventAt: new Date('2024-01-01T10:00:00Z'),
        dedupeKey: null,
        actor: {
          id: BigInt(7),
          username: 'mentioner',
          profile: {
            displayName: 'Mentioner',
            avatarUrl: 'http://example.com/mentioner.jpg',
          },
          followers: [],
        },
        tweet: {
          id: BigInt(300),
          content: '@user mentioned you',
        },
        payload: null,
      };

      mockNotificationsRepository.findByIdForPush.mockResolvedValue(notification);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'Mentioner mentioned you: "@user mentioned you"',
        body: '@user mentioned you',
      });

      await processor.process(job);

      expect(fcmBuilder.buildFcmNotificationText).toHaveBeenCalledWith({
        notificationType: NotificationType.MENTION,
        isAggregated: false,
        previewActors: ['Mentioner'],
        totalActorCount: 1,
        tweetSnippet: '@user mentioned you',
        locale: LanguageCode.EN,
      });

      expect(pushService.sendToDevices).toHaveBeenCalled();
    });

    it('should use default profile picture when actor has no avatar', async () => {
      const job = createMockJob('6', '10');

      const notification = {
        id: BigInt(6),
        type: NotificationType.RETWEET,
        isAggregated: false,
        seen: false,
        latestEventAt: new Date('2024-01-01T10:00:00Z'),
        dedupeKey: 'RETWEET:TWEET:400',
        actor: {
          id: BigInt(8),
          username: 'retweeter',
          profile: null,
          followers: [],
        },
        tweet: {
          id: BigInt(400),
          content: 'Original tweet',
        },
        payload: {
          actorsIds: ['8'],
          actorsPreview: [],
        },
      };

      mockNotificationsRepository.findByIdForPush.mockResolvedValue(notification);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'retweeter retweeted your tweet',
        body: undefined,
      });

      await processor.process(job);

      const call = pushService.sendToDevices.mock.calls[0];
      const payload = call[1];

      expect(payload.notification.image).toBe(DEFAULT_PROFILE_PICTURE);

      const actorSummary = JSON.parse(payload.data.actorSummary);
      expect(actorSummary[0].avatarUrl).toBe(DEFAULT_PROFILE_PICTURE);
    });

    it('should include isFollowing status based on followers', async () => {
      const job = createMockJob('7', '10');

      const notification = {
        id: BigInt(7),
        type: NotificationType.LIKE,
        isAggregated: false,
        seen: false,
        latestEventAt: new Date('2024-01-01T10:00:00Z'),
        dedupeKey: 'LIKE:TWEET:500',
        actor: {
          id: BigInt(9),
          username: 'followerLiker',
          profile: {
            displayName: 'Follower Liker',
            avatarUrl: 'http://example.com/follower.jpg',
          },
          followers: [{ followerId: BigInt(10), followedId: BigInt(9) }],
        },
        tweet: {
          id: BigInt(500),
          content: 'Liked tweet',
        },
        payload: {
          actorsIds: ['9'],
          actorsPreview: [],
        },
      };

      mockNotificationsRepository.findByIdForPush.mockResolvedValue(notification);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'Follower Liker liked your tweet',
        body: 'Liked tweet',
      });

      await processor.process(job);

      const call = pushService.sendToDevices.mock.calls[0];
      const payload = call[1];

      const actorSummary = JSON.parse(payload.data.actorSummary);
      expect(actorSummary[0].isFollowing).toBe(true);
    });

    it('should throw error and log when processing fails', async () => {
      const job = createMockJob('8', '10');
      const error = new Error('Database connection failed');

      mockNotificationsRepository.findByIdForPush.mockRejectedValue(error);

      await expect(processor.process(job)).rejects.toThrow('Database connection failed');

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to process push notification job for notification id 8 to user 10',
        error,
      );
    });

    it('should throw error when push service fails', async () => {
      const job = createMockJob('9', '10');

      const notification = {
        id: BigInt(9),
        type: NotificationType.LIKE,
        isAggregated: false,
        seen: false,
        latestEventAt: new Date('2024-01-01T10:00:00Z'),
        dedupeKey: 'LIKE:TWEET:600',
        actor: {
          id: BigInt(11),
          username: 'liker',
          profile: {
            displayName: 'Liker',
            avatarUrl: 'http://example.com/liker.jpg',
          },
          followers: [],
        },
        tweet: {
          id: BigInt(600),
          content: 'Tweet',
        },
        payload: {
          actorsIds: ['11'],
          actorsPreview: [],
        },
      };

      const pushError = new Error('FCM service unavailable');

      mockNotificationsRepository.findByIdForPush.mockResolvedValue(notification);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);
      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'Liker liked your tweet',
        body: 'Tweet',
      });
      mockPushService.sendToDevices.mockRejectedValue(pushError);

      await expect(processor.process(job)).rejects.toThrow('FCM service unavailable');

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to process push notification job for notification id 9 to user 10',
        pushError,
      );
    });

    it('should handle QUOTE notification type', async () => {
      const job = createMockJob('10', '10');

      const notification = {
        id: BigInt(10),
        type: NotificationType.QUOTE,
        isAggregated: false,
        seen: false,
        latestEventAt: new Date('2024-01-01T10:00:00Z'),
        dedupeKey: null,
        actor: {
          id: BigInt(12),
          username: 'quoter',
          profile: {
            displayName: 'Quoter',
            avatarUrl: 'http://example.com/quoter.jpg',
          },
          followers: [],
        },
        tweet: {
          id: BigInt(700),
          content: 'Quote tweet content',
        },
        payload: {
          actorsIds: ['12'],
          actorsPreview: [],
        },
      };

      mockNotificationsRepository.findByIdForPush.mockResolvedValue(notification);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);
      mockPushService.sendToDevices.mockResolvedValue(undefined);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'Quoter quoted: "Quote tweet content"',
        body: 'Quote tweet content',
      });

      await processor.process(job);

      expect(fcmBuilder.buildFcmNotificationText).toHaveBeenCalledWith({
        notificationType: NotificationType.QUOTE,
        isAggregated: false,
        previewActors: ['Quoter'],
        totalActorCount: 1,
        tweetSnippet: 'Quote tweet content',
        locale: LanguageCode.EN,
      });

      expect(pushService.sendToDevices).toHaveBeenCalled();
    });

    it('should prefer displayName over username in previewActors', async () => {
      const job = createMockJob('11', '10');

      const notification = {
        id: BigInt(11),
        type: NotificationType.LIKE,
        isAggregated: false,
        seen: false,
        latestEventAt: new Date('2024-01-01T10:00:00Z'),
        dedupeKey: 'LIKE:TWEET:800',
        actor: {
          id: BigInt(13),
          username: 'user13',
          profile: {
            displayName: 'User Thirteen',
            avatarUrl: 'http://example.com/user13.jpg',
          },
          followers: [],
        },
        tweet: {
          id: BigInt(800),
          content: 'Content',
        },
        payload: {
          actorsIds: ['13'],
          actorsPreview: [],
        },
      };

      mockNotificationsRepository.findByIdForPush.mockResolvedValue(notification);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);
      mockPushService.sendToDevices.mockResolvedValue(undefined);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'User Thirteen liked your tweet',
        body: 'Content',
      });

      await processor.process(job);

      expect(fcmBuilder.buildFcmNotificationText).toHaveBeenCalledWith(
        expect.objectContaining({
          previewActors: ['User Thirteen'],
        }),
      );
    });

    it('should use username when displayName is null', async () => {
      const job = createMockJob('12', '10');

      const notification = {
        id: BigInt(12),
        type: NotificationType.LIKE,
        isAggregated: false,
        seen: false,
        latestEventAt: new Date('2024-01-01T10:00:00Z'),
        dedupeKey: 'LIKE:TWEET:900',
        actor: {
          id: BigInt(14),
          username: 'user14',
          profile: {
            displayName: null,
            avatarUrl: 'http://example.com/user14.jpg',
          },
          followers: [],
        },
        tweet: {
          id: BigInt(900),
          content: 'Content',
        },
        payload: {
          actorsIds: ['14'],
          actorsPreview: [],
        },
      };

      mockNotificationsRepository.findByIdForPush.mockResolvedValue(notification);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);
      mockPushService.sendToDevices.mockResolvedValue(undefined);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'user14 liked your tweet',
        body: 'Content',
      });

      await processor.process(job);

      expect(fcmBuilder.buildFcmNotificationText).toHaveBeenCalledWith(
        expect.objectContaining({
          previewActors: ['user14'],
        }),
      );
    });
  });
});
