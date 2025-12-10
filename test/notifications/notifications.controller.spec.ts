import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from 'src/notifications/notifications.controller';
import { NotificationsService } from 'src/notifications/notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  const mockNotificationsSerivce: jest.Mocked<Partial<NotificationsService>> = {
    trigger: jest.fn(),
    markAllAsSeen: jest.fn(),
    markAsSeen: jest.fn(),
    getUnseenCount: jest.fn(),
    getNotifications: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: mockNotificationsSerivce }],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUnseenCount', () => {
    it('should return unseen count from the service', async () => {
      (mockNotificationsSerivce.getUnseenCount as jest.Mock).mockResolvedValue(5);

      const result = await controller.getUnseenCount({ id: '100' });

      expect(mockNotificationsSerivce.getUnseenCount).toHaveBeenCalledWith(BigInt('100'));
      expect(result).toEqual({ unseenCount: 5 });
    });
  });

  describe('markAllAsSeen', () => {
    it('should call the service to mark all as seen', async () => {
      (mockNotificationsSerivce.markAllAsSeen as jest.Mock).mockResolvedValue(100);

      const result = await controller.markAllAsSeen({ id: '100' });

      expect(mockNotificationsSerivce.markAllAsSeen).toHaveBeenCalledWith(BigInt('100'));
      expect(result).toEqual({ updatedCount: 100 });
    });
  });

  describe('markAsSeen', () => {
    it('should call the service to mark a notification as seen', async () => {
      (mockNotificationsSerivce.markAsSeen as jest.Mock).mockResolvedValue(1);

      const result = await controller.markAsSeen({ id: '100' }, BigInt('1'));

      expect(mockNotificationsSerivce.markAsSeen).toHaveBeenCalledWith(BigInt('1'), BigInt('100'));
      expect(result).toEqual({ updatedCount: 1 });
    });
  });

  describe('getNotifications', () => {
    const mockUser = { id: '1' };
    const mockResponse = {
      items: [
        {
          id: '1',
          type: 'LIKE',
          actorSummary: {
            totalCount: 1,
            previewActors: [
              {
                username: 'testuser',
                displayName: 'Test User',
                avatarUrl: 'http://example.com/avatar.jpg',
              },
            ],
          },
          tweetSummary: {
            totalCount: 1,
            subjectIds: ['100'],
            primaryTweet: { id: '100', content: 'Test tweet' },
          },
          latestEventAt: new Date('2024-01-01'),
          isSeen: false,
        },
      ],
      pagination: { hasNextPage: false },
    };

    beforeEach(() => {
      (mockNotificationsSerivce.getNotifications as jest.Mock).mockResolvedValue(mockResponse);
    });

    it('should use default limit when limit is not provided', async () => {
      await controller.getNotifications(mockUser);

      expect(mockNotificationsSerivce.getNotifications).toHaveBeenCalledWith(
        BigInt('1'),
        20, // default limit
        undefined,
        undefined,
      );
    });

    it('should use default limit when limit is 0', async () => {
      await controller.getNotifications(mockUser, '0');

      expect(mockNotificationsSerivce.getNotifications).toHaveBeenCalledWith(
        BigInt('1'),
        20, // default limit
        undefined,
        undefined,
      );
    });

    it('should use default limit when limit is negative', async () => {
      await controller.getNotifications(mockUser, '-5');

      expect(mockNotificationsSerivce.getNotifications).toHaveBeenCalledWith(
        BigInt('1'),
        20, // default limit
        undefined,
        undefined,
      );
    });

    it('should use max limit when provided limit is bigger than max', async () => {
      await controller.getNotifications(mockUser, '150');

      expect(mockNotificationsSerivce.getNotifications).toHaveBeenCalledWith(
        BigInt('1'),
        100, // max limit
        undefined,
        undefined,
      );
    });

    it('should use provided limit when valid', async () => {
      await controller.getNotifications(mockUser, '30');

      expect(mockNotificationsSerivce.getNotifications).toHaveBeenCalledWith(
        BigInt('1'),
        30,
        undefined,
        undefined,
      );
    });

    it('should pass cursor to service', async () => {
      const cursor = 'validCursor123';

      await controller.getNotifications(mockUser, undefined, cursor);

      expect(mockNotificationsSerivce.getNotifications).toHaveBeenCalledWith(
        BigInt('1'),
        20,
        cursor,
        undefined,
      );
    });

    it('should pass filter to service', async () => {
      await controller.getNotifications(mockUser, undefined, undefined, 'mentions');

      expect(mockNotificationsSerivce.getNotifications).toHaveBeenCalledWith(
        BigInt('1'),
        20,
        undefined,
        'mentions',
      );
    });

    it('should return items and pagination', async () => {
      const result = await controller.getNotifications(mockUser);

      expect(result).toEqual(mockResponse);
    });

    it('should handle all parameters together', async () => {
      const cursor = 'cursor123';
      const filter = 'mentions';

      await controller.getNotifications(mockUser, '50', cursor, filter);

      expect(mockNotificationsSerivce.getNotifications).toHaveBeenCalledWith(
        BigInt('1'),
        50,
        cursor,
        filter,
      );
    });

    it('should use default limit for invalid string limit', async () => {
      await controller.getNotifications(mockUser, 'invalid');

      expect(mockNotificationsSerivce.getNotifications).toHaveBeenCalledWith(
        BigInt('1'),
        20,
        undefined,
        undefined,
      );
    });

    it('should use default limit for NaN limit', async () => {
      await controller.getNotifications(mockUser, 'NaN');

      expect(mockNotificationsSerivce.getNotifications).toHaveBeenCalledWith(
        BigInt('1'),
        20,
        undefined,
        undefined,
      );
    });

    it('should propagate service errors', async () => {
      const error = new Error('Service error');
      (mockNotificationsSerivce.getNotifications as jest.Mock).mockRejectedValue(error);

      await expect(controller.getNotifications(mockUser)).rejects.toThrow('Service error');
    });
  });
});
