import { Test, TestingModule } from '@nestjs/testing';
import { RequestUser } from 'src/common/interfaces';
import { DevicesController } from 'src/devices/devices.controller';
import { DevicesService } from 'src/devices/devices.service';

const mockDevicesService = {
  registerDevice: jest.fn(),
  togglePushNotifications: jest.fn(),
};

describe('DevicesController', () => {
  let controller: DevicesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DevicesController],
      providers: [
        {
          provide: DevicesService,
          useValue: mockDevicesService,
        },
      ],
    }).compile();

    controller = module.get<DevicesController>(DevicesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('registerDevice', () => {
    it('should call devicesService.registerDevice with correct parameters', async () => {
      const user: RequestUser = { id: '123' };
      const ipAddress = 'localhost';
      const deviceType = 'mobile';
      const deviceDto = { fcmToken: 'sample-fcm-token' };

      const expectedResult = {
        id: BigInt(1),
        userId: BigInt(123),
        fcmToken: 'sample-fcm-token',
        ipAddress: 'localhost',
        deviceType: 'mobile',
      };

      mockDevicesService.registerDevice.mockResolvedValue(expectedResult);

      const result = await controller.registerDevice(user, ipAddress, deviceType, deviceDto);

      expect(mockDevicesService.registerDevice).toHaveBeenCalledWith({
        fcmToken: deviceDto.fcmToken,
        userId: BigInt(user.id),
        ipAddress,
        deviceType,
      });
      expect(result).toEqual({ message: 'Device registered successfully for push notifications.' });
    });
  });

  describe('toggleDeviceNotifications', () => {
    it('should call devicesService.togglePushNotifications with correct parameters', async () => {
      const user: RequestUser = { id: '123' };
      const fcmToken = 'sample-fcm-token';
      const enable = true;

      const expectedResult = {
        id: BigInt(1),
        userId: BigInt(123),
        fcmToken: 'sample-fcm-token',
        pushNotificationsEnabled: enable,
      };

      mockDevicesService.togglePushNotifications.mockResolvedValue(expectedResult);

      const result = await controller.togglePushNotifications(user, { fcmToken, enable });

      expect(mockDevicesService.togglePushNotifications).toHaveBeenCalledWith(
        fcmToken,
        BigInt(user.id),
        enable,
      );
      expect(result).toEqual({
        message: `Push notifications ${enable ? 'enabled' : 'disabled'} successfully.`,
      });
      expect(result).toEqual(expectedResult);
    });
  });
});
