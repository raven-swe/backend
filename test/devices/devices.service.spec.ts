import { Test, TestingModule } from '@nestjs/testing';
import { DevicesService } from 'src/devices/devices.service';
import { DevicesRepository } from 'src/devices/devices.repository';
import { Device } from 'src/devices/interfaces';
import { PrismaService } from 'src/prisma/prisma.service';

describe('DevicesService', () => {
  let service: DevicesService;

  const mockDevicesRepository = {
    removeAllUserDevices: jest.fn(),
    registerDevice: jest.fn(),
    togglePushNotifications: jest.fn(),
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

  describe('register Device', () => {
    it('should correctly call the repository with device data and return the created device', async () => {
      const deviceData: Device = {
        userId: BigInt(123),
        ipAddress: '192.168.1.1',
        deviceType: 'Chrome on Window',
        fcmToken: 'some-fcm-token',
      };

      const expectedCreatedDevice = {
        id: BigInt(1), // The new ID from the database
        user_id: deviceData.userId,
        ip_address: deviceData.ipAddress,
        device_type: deviceData.deviceType,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDevicesRepository.registerDevice.mockResolvedValue(expectedCreatedDevice);

      const result = await service.registerDevice(deviceData, {} as never);

      expect(mockDevicesRepository.registerDevice).toHaveBeenCalledWith(deviceData, {} as never);
      expect(result).toBe(expectedCreatedDevice);
    });

    it('should correctly call the repository with device data and return the created device', async () => {
      const deviceData: Device = {
        userId: BigInt(123),
        ipAddress: '192.168.1.1',
        deviceType: 'Chrome on Window',
        fcmToken: 'some-fcm-token',
      };

      const expectedCreatedDevice = {
        id: BigInt(1), // The new ID from the database
        user_id: deviceData.userId,
        ip_address: deviceData.ipAddress,
        device_type: deviceData.deviceType,
        fcm_token: deviceData.fcmToken,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDevicesRepository.registerDevice.mockResolvedValue(expectedCreatedDevice);

      const result = await service.registerDevice(deviceData, {} as never);

      expect(mockDevicesRepository.registerDevice).toHaveBeenCalledWith(deviceData, {} as never);
      expect(result).toBe(expectedCreatedDevice);
    });
   });

  describe('toggleDeviceNotifications', () => {
    it('should correctly call the repository to toggle push notifications', async () => {
      const fcmToken = 'some-fcm-token';
      const userId = BigInt(123);
      const enable = true;

      const expectedUpdatedDevice = {
        id: BigInt(1),
        user_id: userId,
        fcm_token: fcmToken,
        push_notifications_enabled: enable,
        updated_at: new Date(),
      };

      mockDevicesRepository.togglePushNotifications = jest
        .fn()
        .mockResolvedValue(expectedUpdatedDevice);

      const result = await service.togglePushNotifications(fcmToken, userId, enable);

      expect(mockDevicesRepository.togglePushNotifications).toHaveBeenCalledWith(fcmToken, enable);
      expect(result).toBe(expectedUpdatedDevice);
    });
  });

  describe('toggleDeviceNotifications', () => {
    it('should correctly call the repository to toggle push notifications', async () => {
      const fcmToken = 'some-fcm-token';
      const userId = BigInt(123);
      const enable = true;

      const expectedUpdatedDevice = {
        id: BigInt(1),
        user_id: userId,
        fcm_token: fcmToken,
        push_notifications_enabled: enable,
        updated_at: new Date(),
      };

      mockDevicesRepository.togglePushNotifications = jest
        .fn()
        .mockResolvedValue(expectedUpdatedDevice);

      const result = await service.togglePushNotifications(fcmToken, userId, enable);

      expect(mockDevicesRepository.togglePushNotifications).toHaveBeenCalledWith(fcmToken, enable);
      expect(result).toBe(expectedUpdatedDevice);
    });
  });
});
