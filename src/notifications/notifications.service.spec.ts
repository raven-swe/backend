import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';

describe('NotificationsService', () => {
  let service: NotificationsService;
  const mockNotificationsRepository: jest.Mocked<Partial<NotificationsRepository>> = {
    createNotification: jest.fn(),
    findExisting: jest.fn(),
    markAllAsSeen: jest.fn(),
    markAsSeen: jest.fn(),
    getUnreadCount: jest.fn(),
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

      expect(mockNotificationsRepository.findExisting).toHaveBeenCalledWith({
        actorId: 'user1',
        receiverId: 'user2',
        type: 'LIKE',
      });
      expect(mockNotificationsRepository.createNotification).toHaveBeenCalledWith({
        actorId: 'user1',
        receiverId: 'user2',
        type: 'LIKE',
      });
      expect(result).toEqual(mockNotification);
    });

    it('should return existing notification if found', async () => {
      const mockNotification = { actorId: 'user1', receiverId: 'user2', type: 'LIKE' };
      (mockNotificationsRepository.findExisting as jest.Mock).mockResolvedValue(mockNotification);

      const result = await service.trigger({ actorId: 'user1', receiverId: 'user2', type: 'LIKE' });

      expect(mockNotificationsRepository.findExisting).toHaveBeenCalledWith({
        actorId: 'user1',
        receiverId: 'user2',
        type: 'LIKE',
      });
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

  describe('markAllAsSeen', () => {
    it('should call repository to mark all as seen', async () => {
      (mockNotificationsRepository.markAllAsSeen as jest.Mock).mockResolvedValue({ count: 5 });

      const result = await service.markAllAsSeen('user2');

      expect(mockNotificationsRepository.markAllAsSeen).toHaveBeenCalledWith('user2');
      expect(result).toEqual({ count: 5 });
    });
  });

  describe('markAsSeen', () => {
    it('should call repository to mark a notification as seen', async () => {
      (mockNotificationsRepository.markAsSeen as jest.Mock).mockResolvedValue({ count: 1 });

      const result = await service.markAsSeen('notification1', 'user2');

      expect(mockNotificationsRepository.markAsSeen).toHaveBeenCalledWith('notification1', 'user2');
      expect(result).toEqual({ count: 1 });
    });
  });
  describe('getUnreadCount', () => {
    it('should call repository to get unread count', async () => {
      (mockNotificationsRepository.getUnreadCount as jest.Mock).mockResolvedValue(3);

      const result = await service.getUnreadCount('user2');

      expect(mockNotificationsRepository.getUnreadCount).toHaveBeenCalledWith('user2');
      expect(result).toEqual(3);
    });
  });
});
