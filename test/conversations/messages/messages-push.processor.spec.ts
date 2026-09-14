/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { MessagesPushProcessor } from '../../../src/conversations/messages/messages-push.processor';
import { PushSenderService } from 'src/firebase/push-sender.service';
import { UsersRepository } from 'src/users/users.repository';
import { MediaType, LanguageCode } from '@prisma/client';
import { DEFAULT_PROFILE_PICTURE } from 'src/users/constants';
import * as fcmBuilder from 'src/notifications/utils/fcm-notification-body-builder';
import { ConfigService } from '@nestjs/config';
import { MediaUrlService } from 'src/common/media-url';

const CDN_URL = 'https://cdn.example.com';
const DEFAULT_PROFILE_PICTURE_URL = `${CDN_URL}/${DEFAULT_PROFILE_PICTURE}`;

interface MessageJobData {
  actorId: string;
  conversationId: string;
  messagePreview: string;
  receiverId: string;
  hasMedia?: boolean;
  mediaType?: MediaType | null;
  reaction?: string | null;
}

describe('MessagesPushProcessor', () => {
  let processor: MessagesPushProcessor;
  let pushSender: jest.Mocked<PushSenderService>;
  let usersRepository: jest.Mocked<UsersRepository>;

  const mockPushSender = {
    sendToDevices: jest.fn(),
  };

  const mockUsersRepository = {
    getUsersMetadataById: jest.fn(),
    getUserLocale: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => (key === 'CDN_URL' ? CDN_URL : undefined)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesPushProcessor,
        { provide: PushSenderService, useValue: mockPushSender },
        { provide: UsersRepository, useValue: mockUsersRepository },
        MediaUrlService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    processor = module.get<MessagesPushProcessor>(MessagesPushProcessor);
    pushSender = module.get(PushSenderService);
    usersRepository = module.get(UsersRepository);
  });

  const createMockJob = (data: MessageJobData): Job<MessageJobData> => {
    return {
      data,
    } as Job<MessageJobData>;
  };

  describe('process', () => {
    const baseJobData = {
      actorId: '1',
      conversationId: '100',
      messagePreview: 'Hello there!',
      receiverId: '2',
    };

    const mockActor = {
      id: BigInt(1),
      username: 'alice',
      profile: {
        displayName: 'Alice Smith',
        avatarUrl: 'http://example.com/alice.jpg',
      },
    };

    it('should skip sending when actor not found', async () => {
      const job = createMockJob(baseJobData);

      mockUsersRepository.getUsersMetadataById.mockResolvedValue([]);

      await processor.process(job);

      expect(usersRepository.getUsersMetadataById).toHaveBeenCalledWith([BigInt(1)]);
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Actor with id 1 not found, skipping push notification',
      );
      expect(pushSender.sendToDevices).not.toHaveBeenCalled();
    });

    it('should process text message and send push notification', async () => {
      const job = createMockJob(baseJobData);

      mockUsersRepository.getUsersMetadataById.mockResolvedValue([mockActor]);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'Alice Smith sent you a message: "Hello there!"',
        body: 'Hello there!',
      });

      await processor.process(job);

      expect(usersRepository.getUsersMetadataById).toHaveBeenCalledWith([BigInt(1)]);
      expect(usersRepository.getUserLocale).toHaveBeenCalledWith(BigInt(2));

      expect(fcmBuilder.buildFcmNotificationText).toHaveBeenCalledWith({
        notificationType: 'MESSAGE',
        previewActors: ['Alice Smith'],
        tweetSnippet: 'Hello there!',
        locale: LanguageCode.EN,
        reaction: undefined,
        hasMedia: undefined,
        mediaType: undefined,
      });

      expect(pushSender.sendToDevices).toHaveBeenCalledWith(
        '2',
        expect.objectContaining({
          token: null,
          notification: {
            title: 'Alice Smith sent you a message: "Hello there!"',
            body: 'Hello there!',
            image: 'http://example.com/alice.jpg',
          },
          data: {
            actorSummary: JSON.stringify([
              {
                username: 'alice',
                displayName: 'Alice Smith',
                avatarUrl: 'http://example.com/alice.jpg',
              },
            ]),
            messageSummary: JSON.stringify({
              messagePreview: 'Hello there!',
              conversationId: '100',
            }),
          },
          android: {
            priority: 'high',
            notification: {
              channel_id: 'messages',
              sound: 'default',
              color: '#e5e7ff',
              tag: 'msg:100',
            },
          },
        }),
      );
    });

    it('should handle actor with no displayName (use username)', async () => {
      const job = createMockJob(baseJobData);

      const actorNoDisplayName = {
        id: BigInt(1),
        username: 'bob',
        profile: {
          displayName: null,
          avatarUrl: 'http://example.com/bob.jpg',
        },
      };

      mockUsersRepository.getUsersMetadataById.mockResolvedValue([actorNoDisplayName]);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'bob sent you a message: "Hello there!"',
        body: 'Hello there!',
      });

      await processor.process(job);

      expect(fcmBuilder.buildFcmNotificationText).toHaveBeenCalledWith({
        notificationType: 'MESSAGE',
        previewActors: ['bob'],
        tweetSnippet: 'Hello there!',
        locale: LanguageCode.EN,
        reaction: undefined,
        hasMedia: undefined,
        mediaType: undefined,
      });

      const sendCall = pushSender.sendToDevices.mock.calls[0];
      const payload = sendCall[1];
      expect(payload.data).toBeDefined();
      const actorSummary = JSON.parse(payload.data!.actorSummary) as Array<{
        displayName: string | null;
      }>;
      expect(actorSummary[0].displayName).toBeNull();
    });

    it('should use default profile picture when actor has no avatar', async () => {
      const job = createMockJob(baseJobData);

      const actorNoAvatar = {
        id: BigInt(1),
        username: 'charlie',
        profile: {
          displayName: 'Charlie',
          avatarUrl: null,
        },
      };

      mockUsersRepository.getUsersMetadataById.mockResolvedValue([actorNoAvatar]);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'Charlie sent you a message: "Hello there!"',
        body: 'Hello there!',
      });

      await processor.process(job);

      const sendCall = pushSender.sendToDevices.mock.calls[0];
      const payload = sendCall[1];

      expect(payload.notification).toBeDefined();
      expect((payload.notification as any).image).toBe(DEFAULT_PROFILE_PICTURE_URL);

      expect(payload.data).toBeDefined();
      const actorSummary = JSON.parse(payload.data!.actorSummary) as Array<{ avatarUrl: string }>;
      expect(actorSummary[0].avatarUrl).toBe(DEFAULT_PROFILE_PICTURE_URL);
    });

    it('should use default profile picture when actor has no profile', async () => {
      const job = createMockJob(baseJobData);

      const actorNoProfile = {
        id: BigInt(1),
        username: 'dave',
        profile: null,
      };

      mockUsersRepository.getUsersMetadataById.mockResolvedValue([actorNoProfile]);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'dave sent you a message: "Hello there!"',
        body: 'Hello there!',
      });

      await processor.process(job);

      const sendCall = pushSender.sendToDevices.mock.calls[0];
      const payload = sendCall[1];

      expect(payload.notification).toBeDefined();
      expect((payload.notification as any).image).toBe(DEFAULT_PROFILE_PICTURE_URL);

      expect(payload.data).toBeDefined();
      const actorSummary = JSON.parse(payload.data!.actorSummary) as Array<{ avatarUrl: string }>;
      expect(actorSummary[0].avatarUrl).toBe(DEFAULT_PROFILE_PICTURE_URL);
    });

    it('should process message with photo media', async () => {
      const job = createMockJob({
        ...baseJobData,
        hasMedia: true,
        mediaType: MediaType.IMAGE,
        messagePreview: '',
      });

      mockUsersRepository.getUsersMetadataById.mockResolvedValue([mockActor]);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'Alice Smith sent you a photo',
        body: undefined,
      });

      await processor.process(job);

      expect(fcmBuilder.buildFcmNotificationText).toHaveBeenCalledWith({
        notificationType: 'MESSAGE',
        previewActors: ['Alice Smith'],
        tweetSnippet: '',
        locale: LanguageCode.EN,
        reaction: undefined,
        hasMedia: true,
        mediaType: MediaType.IMAGE,
      });

      const sendCall = pushSender.sendToDevices.mock.calls[0];
      const payload = sendCall[1];

      expect(payload.notification).toBeDefined();
      expect(payload.notification!.title).toBe('Alice Smith sent you a photo');
      expect(payload.notification!.body).toBeUndefined();
    });

    it('should process message with video media', async () => {
      const job = createMockJob({
        ...baseJobData,
        hasMedia: true,
        mediaType: MediaType.VIDEO,
        messagePreview: '',
      });

      mockUsersRepository.getUsersMetadataById.mockResolvedValue([mockActor]);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'Alice Smith sent you a video',
        body: undefined,
      });

      await processor.process(job);

      expect(fcmBuilder.buildFcmNotificationText).toHaveBeenCalledWith({
        notificationType: 'MESSAGE',
        previewActors: ['Alice Smith'],
        tweetSnippet: '',
        locale: LanguageCode.EN,
        reaction: undefined,
        hasMedia: true,
        mediaType: MediaType.VIDEO,
      });

      const sendCall = pushSender.sendToDevices.mock.calls[0];
      const payload = sendCall[1];

      expect(payload.notification).toBeDefined();
      expect(payload.notification!.title).toBe('Alice Smith sent you a video');
    });

    it('should process message with reaction', async () => {
      const job = createMockJob({
        ...baseJobData,
        reaction: '❤️',
        messagePreview: 'Original message',
      });

      mockUsersRepository.getUsersMetadataById.mockResolvedValue([mockActor]);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'Alice Smith reacted ❤️ to your message: "Original message"',
        body: 'Original message',
      });

      await processor.process(job);

      expect(fcmBuilder.buildFcmNotificationText).toHaveBeenCalledWith({
        notificationType: 'MESSAGE',
        previewActors: ['Alice Smith'],
        tweetSnippet: 'Original message',
        locale: LanguageCode.EN,
        reaction: '❤️',
        hasMedia: undefined,
        mediaType: undefined,
      });

      const sendCall = pushSender.sendToDevices.mock.calls[0];
      const payload = sendCall[1];

      expect(payload.notification).toBeDefined();
      expect(payload.notification!.title).toContain('❤️');
    });

    it('should process message in Arabic locale', async () => {
      const job = createMockJob(baseJobData);

      mockUsersRepository.getUsersMetadataById.mockResolvedValue([mockActor]);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.AR);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'أرسل Alice Smith لك رسالة: "Hello there!"',
        body: 'Hello there!',
      });

      await processor.process(job);

      expect(usersRepository.getUserLocale).toHaveBeenCalledWith(BigInt(2));
      expect(fcmBuilder.buildFcmNotificationText).toHaveBeenCalledWith(
        expect.objectContaining({
          locale: LanguageCode.AR,
        }),
      );

      expect(pushSender.sendToDevices).toHaveBeenCalled();
    });

    it('should include conversation tag in android notification', async () => {
      const job = createMockJob({
        ...baseJobData,
        conversationId: '12345',
      });

      mockUsersRepository.getUsersMetadataById.mockResolvedValue([mockActor]);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'Alice Smith sent you a message: "Hello there!"',
        body: 'Hello there!',
      });

      await processor.process(job);

      const sendCall = pushSender.sendToDevices.mock.calls[0];
      const payload = sendCall[1];

      expect(payload.android).toBeDefined();
      expect(payload.android!.notification).toBeDefined();
      expect((payload.android!.notification as any).tag).toBe('msg:12345');
    });

    it('should include message preview in data payload', async () => {
      const job = createMockJob({
        ...baseJobData,
        messagePreview: 'This is a longer message preview for testing',
      });

      mockUsersRepository.getUsersMetadataById.mockResolvedValue([mockActor]);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'Alice Smith sent you a message',
        body: 'This is a longer message preview for testing',
      });

      await processor.process(job);

      const sendCall = pushSender.sendToDevices.mock.calls[0];
      const payload = sendCall[1];

      expect(payload.data).toBeDefined();
      const messageSummary = JSON.parse(payload.data!.messageSummary) as {
        messagePreview: string;
        conversationId: string;
      };
      expect(messageSummary.messagePreview).toBe('This is a longer message preview for testing');
      expect(messageSummary.conversationId).toBe('100');
    });

    it('should set android notification priority to high', async () => {
      const job = createMockJob(baseJobData);

      mockUsersRepository.getUsersMetadataById.mockResolvedValue([mockActor]);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'Alice Smith sent you a message: "Hello there!"',
        body: 'Hello there!',
      });

      await processor.process(job);

      const sendCall = pushSender.sendToDevices.mock.calls[0];
      const payload = sendCall[1];

      expect(payload.android).toBeDefined();
      expect(payload.android!.priority).toBe('high');
      expect(payload.android!.notification).toBeDefined();
      expect((payload.android!.notification as any).channel_id).toBe('messages');
      expect(payload.android!.notification!.sound).toBe('default');
      expect(payload.android!.notification!.color).toBe('#e5e7ff');
    });

    it('should handle error when getting user metadata fails', async () => {
      const job = createMockJob(baseJobData);

      const error = new Error('Database connection failed');
      mockUsersRepository.getUsersMetadataById.mockRejectedValue(error);

      await processor.process(job);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Error processing push notification for message to user 2',
        error,
      );
      expect(pushSender.sendToDevices).not.toHaveBeenCalled();
    });

    it('should handle error when getting user locale fails', async () => {
      const job = createMockJob(baseJobData);

      mockUsersRepository.getUsersMetadataById.mockResolvedValue([mockActor]);

      const error = new Error('Failed to retrieve locale');
      mockUsersRepository.getUserLocale.mockRejectedValue(error);

      await processor.process(job);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Error processing push notification for message to user 2',
        error,
      );
      expect(pushSender.sendToDevices).not.toHaveBeenCalled();
    });

    it('should handle error when push sender fails', async () => {
      const job = createMockJob(baseJobData);

      mockUsersRepository.getUsersMetadataById.mockResolvedValue([mockActor]);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'Alice Smith sent you a message: "Hello there!"',
        body: 'Hello there!',
      });

      const error = new Error('FCM service unavailable');
      mockPushSender.sendToDevices.mockRejectedValue(error);

      await processor.process(job);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Error processing push notification for message to user 2',
        error,
      );
    });

    it('should log debug message with FCM payload', async () => {
      const job = createMockJob(baseJobData);

      mockUsersRepository.getUsersMetadataById.mockResolvedValue([mockActor]);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'Alice Smith sent you a message: "Hello there!"',
        body: 'Hello there!',
      });

      await processor.process(job);

      expect(Logger.prototype.debug).toHaveBeenCalledWith(expect.stringContaining('FCM Payload:'));
    });

    it('should handle empty message preview', async () => {
      const job = createMockJob({
        ...baseJobData,
        messagePreview: '',
      });

      mockUsersRepository.getUsersMetadataById.mockResolvedValue([mockActor]);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'Alice Smith sent you a message',
        body: undefined,
      });

      await processor.process(job);

      expect(fcmBuilder.buildFcmNotificationText).toHaveBeenCalledWith(
        expect.objectContaining({
          tweetSnippet: '',
        }),
      );

      const sendCall = pushSender.sendToDevices.mock.calls[0];
      const payload = sendCall[1];

      expect(payload.notification).toBeDefined();
      expect(payload.notification!.body).toBeUndefined();
    });

    it('should handle null mediaType when hasMedia is false', async () => {
      const job = createMockJob({
        ...baseJobData,
        hasMedia: false,
        mediaType: null,
      });

      mockUsersRepository.getUsersMetadataById.mockResolvedValue([mockActor]);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'Alice Smith sent you a message: "Hello there!"',
        body: 'Hello there!',
      });

      await processor.process(job);

      expect(fcmBuilder.buildFcmNotificationText).toHaveBeenCalledWith({
        notificationType: 'MESSAGE',
        previewActors: ['Alice Smith'],
        tweetSnippet: 'Hello there!',
        locale: LanguageCode.EN,
        reaction: undefined,
        hasMedia: false,
        mediaType: null,
      });

      expect(pushSender.sendToDevices).toHaveBeenCalled();
    });

    it('should handle null reaction', async () => {
      const job = createMockJob({
        ...baseJobData,
        reaction: null,
      });

      mockUsersRepository.getUsersMetadataById.mockResolvedValue([mockActor]);
      mockUsersRepository.getUserLocale.mockResolvedValue(LanguageCode.EN);

      jest.spyOn(fcmBuilder, 'buildFcmNotificationText').mockReturnValue({
        title: 'Alice Smith sent you a message: "Hello there!"',
        body: 'Hello there!',
      });

      await processor.process(job);

      expect(fcmBuilder.buildFcmNotificationText).toHaveBeenCalledWith({
        notificationType: 'MESSAGE',
        previewActors: ['Alice Smith'],
        tweetSnippet: 'Hello there!',
        locale: LanguageCode.EN,
        reaction: null,
        hasMedia: undefined,
        mediaType: undefined,
      });

      expect(pushSender.sendToDevices).toHaveBeenCalled();
    });
  });
});
