import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  const mockNotificationsSerivce: jest.Mocked<Partial<NotificationsService>> = {
    trigger: jest.fn(),
    markAllAsSeen: jest.fn(),
    markAsSeen: jest.fn(),
    getUnseenCount: jest.fn(),
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

      const result = await controller.getUnseenCount({ id: 'user1' });

      expect(mockNotificationsSerivce.getUnseenCount).toHaveBeenCalledWith('user1');
      expect(result).toBe(5);
    });
  });

  describe('markAllAsSeen', () => {
    it('should call the service to mark all as seen', async () => {
      (mockNotificationsSerivce.markAllAsSeen as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.markAllAsSeen({ id: 'user1' });

      expect(mockNotificationsSerivce.markAllAsSeen).toHaveBeenCalledWith('user1');
      expect(result).toBeUndefined();
    });
  });

  describe('markAsSeen', () => {
    it('should call the service to mark a notification as seen', async () => {
      (mockNotificationsSerivce.markAsSeen as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.markAsSeen({ id: 'user1' }, 'notification123');

      expect(mockNotificationsSerivce.markAsSeen).toHaveBeenCalledWith('notification123', 'user1');
      expect(result).toBeUndefined();
    });
  });
});
