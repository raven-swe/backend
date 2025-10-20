import { Test, TestingModule } from '@nestjs/testing';
import { DevicesService } from './devices.service';
import { DevicesRepository } from './devices.repository';

describe('DevicesService', () => {
  let service: DevicesService;

  const mockDevicesRepository = {
    removeAllUserDevices: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        {
          provide: DevicesRepository,
          useValue: mockDevicesRepository,
        },
      ],
    }).compile();

    service = module.get<DevicesService>(DevicesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('removeAllUserDevices', () => {
    it('should call devices.removeAllUserDevices with correct userId', async () => {
      const userId = BigInt(123);
      const mockDeletedCount = { count: 3 };

      mockDevicesRepository.removeAllUserDevices.mockResolvedValue(mockDeletedCount);

      const result = await service.removeAllUserDevices(userId);

      expect(mockDevicesRepository.removeAllUserDevices).toHaveBeenCalledWith(userId);
      expect(mockDevicesRepository.removeAllUserDevices).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockDeletedCount);
    });

    it('should return deleted count as zero if no devices found', async () => {
      const userId = BigInt(456);
      const mockDeletedCount = { count: 0 };

      mockDevicesRepository.removeAllUserDevices.mockResolvedValue(mockDeletedCount);

      const result = await service.removeAllUserDevices(userId);

      expect(mockDevicesRepository.removeAllUserDevices).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockDeletedCount);
    });

    it('should handle large userId values', async () => {
      const userId = BigInt('9223372036854775807');
      const mockDeletedCount = { count: 2 };

      mockDevicesRepository.removeAllUserDevices.mockResolvedValue(mockDeletedCount);

      const result = await service.removeAllUserDevices(userId);

      expect(mockDevicesRepository.removeAllUserDevices).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockDeletedCount);
    });
  });
});
