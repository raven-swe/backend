import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DevicesRepository } from 'src/devices/devices.repository';
import * as admin from 'firebase-admin';
import { PushSenderService } from 'src/firebase/push-sender.service';

// Mock firebase-admin
jest.mock('firebase-admin', () => ({
  messaging: jest.fn(),
}));

const mockMessaging = {
  sendEachForMulticast: jest.fn(),
};

const mockDevicesRepository = {
  getUserDevices: jest.fn(),
  deleteDevicesByTokens: jest.fn(),
};

const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('PushSenderService', () => {
  let service: PushSenderService;
  let loggerLogSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();

    (admin.messaging as jest.Mock).mockReturnValue(mockMessaging);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushSenderService,
        { provide: DevicesRepository, useValue: mockDevicesRepository },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<PushSenderService>(PushSenderService);

    loggerLogSpy = jest
      .spyOn((service as unknown as { logger: Logger }).logger, 'log')
      .mockImplementation(() => {});
    loggerWarnSpy = jest
      .spyOn((service as unknown as { logger: Logger }).logger, 'warn')
      .mockImplementation(() => {});
    loggerErrorSpy = jest
      .spyOn((service as unknown as { logger: Logger }).logger, 'error')
      .mockImplementation(() => {});
  });

  describe('sendToDevices', () => {
    const userId = '123';
    const mockPayload: Omit<admin.messaging.MulticastMessage, 'tokens'> = {
      notification: {
        title: 'Test Notification',
        body: 'Test Body',
      },
      data: {
        id: '1',
        type: 'LIKE',
      },
      android: {
        priority: 'normal',
        notification: {
          channelId: 'default',
        },
      },
    };

    it('should skip sending when no devices found for user', async () => {
      mockDevicesRepository.getUserDevices.mockResolvedValue([]);

      await service.sendToDevices(userId, mockPayload);

      expect(mockDevicesRepository.getUserDevices).toHaveBeenCalledWith(BigInt(123));
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'No devices found for user 123, skipping push notification',
      );
      expect(mockMessaging.sendEachForMulticast).not.toHaveBeenCalled();
    });

    it('should skip sending when devices have no FCM tokens', async () => {
      const devices = [
        { id: BigInt(1), userId: BigInt(123), fcmToken: null },
        { id: BigInt(2), userId: BigInt(123), fcmToken: '' },
      ];

      mockDevicesRepository.getUserDevices.mockResolvedValue(devices);

      await service.sendToDevices(userId, mockPayload);

      expect(mockDevicesRepository.getUserDevices).toHaveBeenCalledWith(BigInt(123));
      expect(loggerLogSpy).toHaveBeenCalledWith('Found 2 devices for user 123');
      expect(mockMessaging.sendEachForMulticast).not.toHaveBeenCalled();
    });

    it('should send notification to all devices with valid tokens', async () => {
      const devices = [
        { id: BigInt(1), userId: BigInt(123), fcmToken: 'token1' },
        { id: BigInt(2), userId: BigInt(123), fcmToken: 'token2' },
        { id: BigInt(3), userId: BigInt(123), fcmToken: 'token3' },
      ];

      const mockResponse = {
        successCount: 3,
        failureCount: 0,
        responses: [
          { success: true, messageId: 'msg1' },
          { success: true, messageId: 'msg2' },
          { success: true, messageId: 'msg3' },
        ],
      };

      mockDevicesRepository.getUserDevices.mockResolvedValue(devices);
      mockMessaging.sendEachForMulticast.mockResolvedValue(mockResponse);

      await service.sendToDevices(userId, mockPayload);

      expect(mockDevicesRepository.getUserDevices).toHaveBeenCalledWith(BigInt(123));
      expect(loggerLogSpy).toHaveBeenCalledWith('Found 3 devices for user 123');
      expect(loggerLogSpy).toHaveBeenCalledWith('tokens: token1, token2, token3');
      expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledWith({
        tokens: ['token1', 'token2', 'token3'],
        notification: mockPayload.notification,
        data: mockPayload.data,
        android: mockPayload.android,
      });
      expect(loggerLogSpy).toHaveBeenCalledWith('response: ', mockResponse);
      expect(mockDevicesRepository.deleteDevicesByTokens).not.toHaveBeenCalled();
    });

    it('should filter out null and empty tokens before sending', async () => {
      const devices = [
        { id: BigInt(1), userId: BigInt(123), fcmToken: 'token1' },
        { id: BigInt(2), userId: BigInt(123), fcmToken: null },
        { id: BigInt(3), userId: BigInt(123), fcmToken: 'token2' },
        { id: BigInt(4), userId: BigInt(123), fcmToken: '' },
        { id: BigInt(5), userId: BigInt(123), fcmToken: 'token3' },
      ];

      const mockResponse = {
        successCount: 3,
        failureCount: 0,
        responses: [
          { success: true, messageId: 'msg1' },
          { success: true, messageId: 'msg2' },
          { success: true, messageId: 'msg3' },
        ],
      };

      mockDevicesRepository.getUserDevices.mockResolvedValue(devices);
      mockMessaging.sendEachForMulticast.mockResolvedValue(mockResponse);

      await service.sendToDevices(userId, mockPayload);

      expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledWith({
        tokens: ['token1', 'token2', 'token3'],
        notification: mockPayload.notification,
        data: mockPayload.data,
        android: mockPayload.android,
      });
    });

    it('should handle partial failures and delete invalid tokens', async () => {
      const devices = [
        { id: BigInt(1), userId: BigInt(123), fcmToken: 'validToken1' },
        { id: BigInt(2), userId: BigInt(123), fcmToken: 'invalidToken1' },
        { id: BigInt(3), userId: BigInt(123), fcmToken: 'validToken2' },
        { id: BigInt(4), userId: BigInt(123), fcmToken: 'invalidToken2' },
      ];

      const mockResponse = {
        successCount: 2,
        failureCount: 2,
        responses: [
          { success: true, messageId: 'msg1' },
          {
            success: false,
            error: {
              code: 'messaging/invalid-registration-token',
              message: 'Invalid token',
            } as admin.FirebaseError,
          },
          { success: true, messageId: 'msg2' },
          {
            success: false,
            error: {
              code: 'messaging/registration-token-not-registered',
              message: 'Token not registered',
            } as admin.FirebaseError,
          },
        ],
      };

      mockDevicesRepository.getUserDevices.mockResolvedValue(devices);
      mockMessaging.sendEachForMulticast.mockResolvedValue(mockResponse);

      await service.sendToDevices(userId, mockPayload);

      expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledWith({
        tokens: ['validToken1', 'invalidToken1', 'validToken2', 'invalidToken2'],
        notification: mockPayload.notification,
        data: mockPayload.data,
        android: mockPayload.android,
      });

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Failed to send notification to token invalidToken1: Invalid token',
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Failed to send notification to token invalidToken2: Token not registered',
      );

      expect(mockDevicesRepository.deleteDevicesByTokens).toHaveBeenCalledWith([
        'invalidToken1',
        'invalidToken2',
      ]);
      expect(loggerLogSpy).toHaveBeenCalledWith('Deleted 2 invalid tokens for user 123');
    });

    it('should not delete tokens for non-registration errors', async () => {
      const devices = [
        { id: BigInt(1), userId: BigInt(123), fcmToken: 'token1' },
        { id: BigInt(2), userId: BigInt(123), fcmToken: 'token2' },
      ];

      const mockResponse = {
        successCount: 1,
        failureCount: 1,
        responses: [
          { success: true, messageId: 'msg1' },
          {
            success: false,
            error: {
              code: 'messaging/internal-error',
              message: 'Internal server error',
            } as admin.FirebaseError,
          },
        ],
      };

      mockDevicesRepository.getUserDevices.mockResolvedValue(devices);
      mockMessaging.sendEachForMulticast.mockResolvedValue(mockResponse);

      await service.sendToDevices(userId, mockPayload);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Failed to send notification to token token2: Internal server error',
      );
      expect(mockDevicesRepository.deleteDevicesByTokens).not.toHaveBeenCalled();
    });

    it('should handle mix of registration and non-registration errors', async () => {
      const devices = [
        { id: BigInt(1), userId: BigInt(123), fcmToken: 'token1' },
        { id: BigInt(2), userId: BigInt(123), fcmToken: 'invalidToken' },
        { id: BigInt(3), userId: BigInt(123), fcmToken: 'token3' },
        { id: BigInt(4), userId: BigInt(123), fcmToken: 'token4' },
      ];

      const mockResponse = {
        successCount: 2,
        failureCount: 2,
        responses: [
          { success: true, messageId: 'msg1' },
          {
            success: false,
            error: {
              code: 'messaging/invalid-registration-token',
              message: 'Invalid token',
            } as admin.FirebaseError,
          },
          {
            success: false,
            error: {
              code: 'messaging/quota-exceeded',
              message: 'Quota exceeded',
            } as admin.FirebaseError,
          },
          { success: true, messageId: 'msg4' },
        ],
      };

      mockDevicesRepository.getUserDevices.mockResolvedValue(devices);
      mockMessaging.sendEachForMulticast.mockResolvedValue(mockResponse);

      await service.sendToDevices(userId, mockPayload);

      expect(mockDevicesRepository.deleteDevicesByTokens).toHaveBeenCalledWith(['invalidToken']);
      expect(loggerLogSpy).toHaveBeenCalledWith('Deleted 1 invalid tokens for user 123');
    });

    it('should handle errors from Firebase messaging gracefully', async () => {
      const devices = [{ id: BigInt(1), userId: BigInt(123), fcmToken: 'token1' }];

      const error = new Error('Firebase connection timeout');

      mockDevicesRepository.getUserDevices.mockResolvedValue(devices);
      mockMessaging.sendEachForMulticast.mockRejectedValue(error);

      await service.sendToDevices(userId, mockPayload);

      expect(mockMessaging.sendEachForMulticast).toHaveBeenCalled();
      expect(loggerErrorSpy).toHaveBeenCalledWith('Error sending push to user 123', error);
      expect(mockDevicesRepository.deleteDevicesByTokens).not.toHaveBeenCalled();
    });

    it('should handle errors from devicesRepository.getUserDevices', async () => {
      const error = new Error('Database connection failed');

      mockDevicesRepository.getUserDevices.mockRejectedValue(error);

      await expect(service.sendToDevices(userId, mockPayload)).rejects.toThrow(
        'Database connection failed',
      );

      expect(mockMessaging.sendEachForMulticast).not.toHaveBeenCalled();
    });

    it('should handle all devices having invalid tokens', async () => {
      const devices = [
        { id: BigInt(1), userId: BigInt(123), fcmToken: 'invalidToken1' },
        { id: BigInt(2), userId: BigInt(123), fcmToken: 'invalidToken2' },
        { id: BigInt(3), userId: BigInt(123), fcmToken: 'invalidToken3' },
      ];

      const mockResponse = {
        successCount: 0,
        failureCount: 3,
        responses: [
          {
            success: false,
            error: {
              code: 'messaging/invalid-registration-token',
              message: 'Invalid token',
            } as admin.FirebaseError,
          },
          {
            success: false,
            error: {
              code: 'messaging/registration-token-not-registered',
              message: 'Token not registered',
            } as admin.FirebaseError,
          },
          {
            success: false,
            error: {
              code: 'messaging/invalid-registration-token',
              message: 'Invalid token',
            } as admin.FirebaseError,
          },
        ],
      };

      mockDevicesRepository.getUserDevices.mockResolvedValue(devices);
      mockMessaging.sendEachForMulticast.mockResolvedValue(mockResponse);

      await service.sendToDevices(userId, mockPayload);

      expect(mockDevicesRepository.deleteDevicesByTokens).toHaveBeenCalledWith([
        'invalidToken1',
        'invalidToken2',
        'invalidToken3',
      ]);
      expect(loggerLogSpy).toHaveBeenCalledWith('Deleted 3 invalid tokens for user 123');
    });

    it('should handle response with missing error details', async () => {
      const devices = [
        { id: BigInt(1), userId: BigInt(123), fcmToken: 'token1' },
        { id: BigInt(2), userId: BigInt(123), fcmToken: 'token2' },
      ];

      const mockResponse = {
        successCount: 1,
        failureCount: 1,
        responses: [
          { success: true, messageId: 'msg1' },
          {
            success: false,
            error: undefined,
          },
        ],
      };

      mockDevicesRepository.getUserDevices.mockResolvedValue(devices);
      mockMessaging.sendEachForMulticast.mockResolvedValue(mockResponse);

      await service.sendToDevices(userId, mockPayload);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Failed to send notification to token token2: undefined',
      );
      expect(mockDevicesRepository.deleteDevicesByTokens).not.toHaveBeenCalled();
    });

    it('should handle large number of devices', async () => {
      const devices = Array.from({ length: 100 }, (_, i) => ({
        id: BigInt(i + 1),
        userId: BigInt(123),
        fcmToken: `token${i + 1}`,
      }));

      const mockResponse = {
        successCount: 100,
        failureCount: 0,
        responses: Array.from({ length: 100 }, (_, i) => ({
          success: true,
          messageId: `msg${i + 1}`,
        })),
      };

      mockDevicesRepository.getUserDevices.mockResolvedValue(devices);
      mockMessaging.sendEachForMulticast.mockResolvedValue(mockResponse);

      await service.sendToDevices(userId, mockPayload);

      expect(loggerLogSpy).toHaveBeenCalledWith('Found 100 devices for user 123');
      expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: expect.arrayContaining(['token1', 'token50', 'token100']) as string[],
        }),
      );
      expect(mockDevicesRepository.deleteDevicesByTokens).not.toHaveBeenCalled();
    });

    it('should pass notification payload correctly to Firebase', async () => {
      const devices = [{ id: BigInt(1), userId: BigInt(123), fcmToken: 'token1' }];

      const complexPayload: Omit<admin.messaging.MulticastMessage, 'tokens'> = {
        notification: {
          title: 'Complex Notification',
          body: 'With body text',
        },
        data: {
          id: '999',
          type: 'MENTION',
          actorSummary: JSON.stringify({ username: 'test' }),
          tweetSubjectIds: JSON.stringify(['100', '200']),
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'mentions',
            sound: 'default',
            color: '#FF5733',
            tag: 'MENTION:TWEET:100',
          },
        },
      };

      const mockResponse = {
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true, messageId: 'msg1' }],
      };

      mockDevicesRepository.getUserDevices.mockResolvedValue(devices);
      mockMessaging.sendEachForMulticast.mockResolvedValue(mockResponse);

      await service.sendToDevices(userId, complexPayload);

      expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledWith({
        tokens: ['token1'],
        notification: complexPayload.notification,
        data: complexPayload.data,
        android: complexPayload.android,
      });
    });
  });
});
