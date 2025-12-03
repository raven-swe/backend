import { Test, TestingModule } from '@nestjs/testing';
import { EventPublisherService, SseEvent } from 'src/sse/event-publisher.service';
import { SseService } from 'src/sse/sse.service';

describe('EventPublisherService', () => {
  let service: EventPublisherService;

  const mockSseService = {
    publish: jest.fn(),
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
