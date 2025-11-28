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
});
