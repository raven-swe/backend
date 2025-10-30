import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';

describe('NotificationsService', () => {
  let service: NotificationsService;
  const mockNotificationsRepository: jest.Mocked<Partial<NotificationsRepository>> = {
    createNotification: jest.fn(),
    findExisting: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationsRepository, useValue: mockNotificationsRepository },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('trigger', () => {
    it('should create a notification if none exists and actorId != receiverId', async () => {
      const mockNotification = { actorId: 'user1', receiverId: 'user2', type: 'LIKE' };
      (mockNotificationsRepository.findExisting as jest.Mock).mockResolvedValue(null);
      (mockNotificationsRepository.createNotification as jest.Mock).mockResolvedValue(
        mockNotification,
      );

      const result = await service.trigger({ actorId: 'user1', receiverId: 'user2', type: 'LIKE' });

      expect(mockNotificationsRepository.findExisting).toHaveBeenCalledWith({ actorId: 'user1', receiverId: 'user2', type: 'LIKE' });
      expect(mockNotificationsRepository.createNotification).toHaveBeenCalledWith({ actorId: 'user1', receiverId: 'user2', type: 'LIKE' });
      expect(result).toEqual(mockNotification);
    });

    it('should return existing notification if found', async () => {
      const mockNotification = { actorId: 'user1', receiverId: 'user2', type: 'LIKE' };
      (mockNotificationsRepository.findExisting as jest.Mock).mockResolvedValue(mockNotification);

      const result = await service.trigger({ actorId: 'user1', receiverId: 'user2', type: 'LIKE' });

      expect(mockNotificationsRepository.findExisting).toHaveBeenCalledWith({ actorId: 'user1', receiverId: 'user2', type: 'LIKE' });
      expect(mockNotificationsRepository.createNotification).not.toHaveBeenCalled();
      expect(result).toEqual(mockNotification);
    });

    it('should not create notification if actorId equals receiverId', async () => {
      const result = await service.trigger({ actorId: 'user1', receiverId: 'user1', type: 'LIKE' });

      expect(mockNotificationsRepository.findExisting).not.toHaveBeenCalled();
      expect(mockNotificationsRepository.createNotification).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });
});
