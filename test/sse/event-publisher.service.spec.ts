import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventPublisherService, SseEvent } from 'src/sse/event-publisher.service';
import { SseService } from 'src/sse/sse.service';
import { MediaUrlService } from 'src/common/media-url';

const CDN_URL = 'https://cdn.example.com';

describe('EventPublisherService', () => {
  let service: EventPublisherService;

  const mockSseService = {
    publish: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => (key === 'CDN_URL' ? CDN_URL : undefined)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventPublisherService,
        {
          provide: SseService,
          useValue: mockSseService,
        },
        MediaUrlService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EventPublisherService>(EventPublisherService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publishToUser', () => {
    it('should publish an event to a single user', async () => {
      const userId = '123';
      const event: SseEvent = {
        event: 'test.event',
        data: { message: 'Hello' },
      };

      await service.publishToUser(userId, event);

      expect(mockSseService.publish).toHaveBeenCalledTimes(1);
      expect(mockSseService.publish).toHaveBeenCalledWith(userId, event);
    });

    it('should handle different event types', async () => {
      const userId = '456';
      const event: SseEvent = {
        event: 'dm.new_message',
        data: { messageId: '789', content: 'Test message' },
      };

      await service.publishToUser(userId, event);

      expect(mockSseService.publish).toHaveBeenCalledWith(userId, event);
    });
  });

  describe('media url resolution', () => {
    it('should expand relative media paths before publishing to a user', async () => {
      const event: SseEvent = {
        event: 'dm.new_message',
        data: { sender: { avatarUrl: 'avatars/file.jpg' }, mediaUrl: 'messages/clip.mp4' },
      };

      await service.publishToUser('123', event);

      expect(mockSseService.publish).toHaveBeenCalledWith('123', {
        event: 'dm.new_message',
        data: {
          sender: { avatarUrl: `${CDN_URL}/avatars/file.jpg` },
          mediaUrl: `${CDN_URL}/messages/clip.mp4`,
        },
      });
    });

    it('should expand relative media paths once when publishing to many users', async () => {
      const event: SseEvent = {
        event: 'dm.new_message',
        data: { sender: { avatarUrl: 'avatars/file.jpg' } },
      };

      await service.publishToUsers(['1', '2'], event);

      const expected = {
        event: 'dm.new_message',
        data: { sender: { avatarUrl: `${CDN_URL}/avatars/file.jpg` } },
      };

      expect(mockSseService.publish).toHaveBeenCalledWith('1', expected);
      expect(mockSseService.publish).toHaveBeenCalledWith('2', expected);
    });

    it('should leave absolute media urls untouched', async () => {
      const event: SseEvent = {
        event: 'dm.new_message',
        data: { mediaUrl: 'https://media.tenor.com/test.gif' },
      };

      await service.publishToUser('123', event);

      expect(mockSseService.publish).toHaveBeenCalledWith('123', {
        event: 'dm.new_message',
        data: { mediaUrl: 'https://media.tenor.com/test.gif' },
      });
    });
  });

  describe('publishToUsers', () => {
    it('should publish an event to multiple users', async () => {
      const userIds = ['1', '2', '3'];
      const event: SseEvent = {
        event: 'broadcast.event',
        data: { notification: 'Hello everyone' },
      };

      await service.publishToUsers(userIds, event);

      expect(mockSseService.publish).toHaveBeenCalledTimes(3);
      expect(mockSseService.publish).toHaveBeenCalledWith('1', event);
      expect(mockSseService.publish).toHaveBeenCalledWith('2', event);
      expect(mockSseService.publish).toHaveBeenCalledWith('3', event);
    });

    it('should handle empty user array', async () => {
      const userIds: string[] = [];
      const event: SseEvent = {
        event: 'test.event',
        data: {},
      };

      await service.publishToUsers(userIds, event);

      expect(mockSseService.publish).not.toHaveBeenCalled();
    });

    it('should publish to single user in array', async () => {
      const userIds = ['100'];
      const event: SseEvent = {
        event: 'single.user',
        data: { count: 5 },
      };

      await service.publishToUsers(userIds, event);

      expect(mockSseService.publish).toHaveBeenCalledTimes(1);
      expect(mockSseService.publish).toHaveBeenCalledWith('100', event);
    });
  });
});
