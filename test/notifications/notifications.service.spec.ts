import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationsRepository } from 'src/notifications/notifications.repository';

describe('NotificationsService', () => {
  let service: NotificationsService;
  const mockNotificationsRepository: jest.Mocked<Partial<NotificationsRepository>> = {
    createNotification: jest.fn(),
    findExisting: jest.fn(),
    findById: jest.fn(),
    markAllAsSeen: jest.fn(),
    markAsSeen: jest.fn(),
    getUnseenCount: jest.fn(),
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
      const mockNotification = { actorId: '1', receiverId: '2', type: 'LIKE' };
      (mockNotificationsRepository.findExisting as jest.Mock).mockResolvedValue(null);
      (mockNotificationsRepository.createNotification as jest.Mock).mockResolvedValue(
        mockNotification,
      );

      const result = await service.trigger({
        actorId: BigInt(mockNotification.actorId),
        receiverId: BigInt(mockNotification.receiverId),
        type: 'LIKE',
      });

      expect(mockNotificationsRepository.findExisting).toHaveBeenCalledWith({
        actorId: BigInt(mockNotification.actorId),
        receiverId: BigInt(mockNotification.receiverId),
        type: 'LIKE',
      });
      expect(mockNotificationsRepository.createNotification).toHaveBeenCalledWith({
        actorId: BigInt(mockNotification.actorId),
        receiverId: BigInt(mockNotification.receiverId),
        type: 'LIKE',
      });
      expect(result).toEqual(mockNotification);
    });

    it('should return existing notification if found', async () => {
      const mockNotification = { actorId: '1', receiverId: '2', type: 'LIKE' };
      (mockNotificationsRepository.findExisting as jest.Mock).mockResolvedValue(mockNotification);

      const result = await service.trigger({
        actorId: BigInt(mockNotification.actorId),
        receiverId: BigInt(mockNotification.receiverId),
        type: 'LIKE',
      });

      expect(mockNotificationsRepository.findExisting).toHaveBeenCalledWith({
        actorId: BigInt(mockNotification.actorId),
        receiverId: BigInt(mockNotification.receiverId),
        type: 'LIKE',
      });
      expect(mockNotificationsRepository.createNotification).not.toHaveBeenCalled();
      expect(result).toEqual(mockNotification);
    });

    it('should not create notification if actorId equals receiverId', async () => {
      const mockNotification = { actorId: '1', receiverId: '1', type: 'LIKE' };
      const result = await service.trigger({
        actorId: BigInt(mockNotification.actorId),
        receiverId: BigInt(mockNotification.receiverId),
        type: 'LIKE',
      });

      expect(mockNotificationsRepository.findExisting).not.toHaveBeenCalled();
      expect(mockNotificationsRepository.createNotification).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe('markAllAsSeen', () => {
    it('should call repository to mark all as seen', async () => {
      (mockNotificationsRepository.markAllAsSeen as jest.Mock).mockResolvedValue({ count: 5 });

      const result = await service.markAllAsSeen(BigInt('2'));

      expect(mockNotificationsRepository.markAllAsSeen).toHaveBeenCalledWith(BigInt('2'));
      expect(result).toBe(5);
    });
  });

  describe('markAsSeen', () => {
    it('should call repository to mark a notification as seen', async () => {
      (mockNotificationsRepository.markAsSeen as jest.Mock).mockResolvedValue({ count: 1 });
      (mockNotificationsRepository.findById as jest.Mock).mockResolvedValue({ id: BigInt('1') });

      const result = await service.markAsSeen(BigInt('1'), BigInt('2'));
      expect(mockNotificationsRepository.markAsSeen).toHaveBeenCalledWith(BigInt('1'), BigInt('2'));
      expect(result).toBe(1);
    });

    it('should fail when notification is not found', async () => {
      (mockNotificationsRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.markAsSeen(BigInt('1'), BigInt('2'))).rejects.toThrow(
        'Notification not found',
      );
    });
  });
  describe('getUnseenCount', () => {
    it('should call repository to get unseen count', async () => {
      (mockNotificationsRepository.getUnseenCount as jest.Mock).mockResolvedValue(3);

      const result = await service.getUnseenCount(BigInt('1'));

      expect(mockNotificationsRepository.getUnseenCount).toHaveBeenCalledWith(BigInt('1'));
      expect(result).toEqual(3);
    });
  });
});
