import { Test, TestingModule } from '@nestjs/testing';
import { DevicesService } from './devices.service';
import { DevicesRepository } from './devices.repository';
import { Device, DeviceType } from '../devices/interfaces/device.interface';
import { PrismaService } from 'src/prisma/prisma.service';

describe('DevicesService', () => {
  let service: DevicesService;

  const mockDevicesRepository = {
    removeAllUserDevices: jest.fn(),
    createDevice: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        {
          provide: DevicesRepository,
          useValue: mockDevicesRepository,
        },
        { provide: PrismaService, useValue: {} },
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

  describe('createDevice', () => {
    it('should correctly call the repository with device data and return the created device', async () => {
      const deviceData: Device = {
        userId: BigInt(123),
        ipAddress: '192.168.1.1',
        deviceType: DeviceType.MOBILE,
      };

      const expectedCreatedDevice = {
        id: BigInt(1), // The new ID from the database
        user_id: deviceData.userId,
        ip_address: deviceData.ipAddress,
        device_type: deviceData.deviceType,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDevicesRepository.createDevice.mockResolvedValue(expectedCreatedDevice);

      const result = await service.createDevice(deviceData, {} as never);

      expect(mockDevicesRepository.createDevice).toHaveBeenCalledWith(deviceData, {} as never);
      expect(result).toBe(expectedCreatedDevice);
    });
  });

  describe('createDevice', () => {
    it('should correctly call the repository with device data and return the created device', async () => {
      const deviceData: Device = {
        userId: BigInt(123),
        ipAddress: '192.168.1.1',
        deviceType: DeviceType.WEB,
      };

      const expectedCreatedDevice = {
        id: BigInt(1), // The new ID from the database
        user_id: deviceData.userId,
        ip_address: deviceData.ipAddress,
        device_type: deviceData.deviceType,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDevicesRepository.createDevice.mockResolvedValue(expectedCreatedDevice);

      const result = await service.createDevice(deviceData, {} as never);

      expect(mockDevicesRepository.createDevice).toHaveBeenCalledWith(deviceData, {} as never);
      expect(result).toBe(expectedCreatedDevice);
    });
  });
});
