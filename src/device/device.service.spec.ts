import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DevicesService } from './device.service';
import { DevicesRepository } from './device.repository'; // The primary dependency to mock.
import { PrismaService } from 'src/prisma/prisma.service';
import { Device, DeviceType } from './interfaces/device.interface';

describe('DevicesService', () => {
  let service: DevicesService;
  let mockDevicesRepository: Partial<DevicesRepository>;

  beforeEach(async () => {
    mockDevicesRepository = {
      createDevice: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: DevicesRepository, useValue: mockDevicesRepository },
        { provide: PrismaService, useValue: {} },
        Logger,
      ],
    }).compile();

    service = module.get<DevicesService>(DevicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDevice', () => {
    it('should correctly call the repository with device data and return the created device', async () => {
      const deviceData: Device = {
        userId: BigInt(123),
        ipAddress: '192.168.1.1',
        deviceType: DeviceType.ANDROID,
      };

      const expectedCreatedDevice = {
        id: BigInt(1), // The new ID from the database
        user_id: deviceData.userId,
        ip_address: deviceData.ipAddress,
        device_type: deviceData.deviceType,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (mockDevicesRepository.createDevice as jest.Mock).mockResolvedValue(expectedCreatedDevice);

      const result = await service.createDevice(deviceData, {} as never);

      expect(mockDevicesRepository.createDevice).toHaveBeenCalledWith(deviceData, {} as never);
      expect(result).toBe(expectedCreatedDevice);
    });
  });
});
