import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { EmailConsumer, EmailJobData } from './email.consumer';
import { EmailService, OtpType } from './email.service';
import { Job } from 'bullmq';

describe('EmailConsumer', () => {
  let consumer: EmailConsumer;

  const mockEmailService = {
    sendRegistrationOtp: jest.fn(),
    sendForgotPasswordOtp: jest.fn(),
  };

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailConsumer,
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    consumer = module.get<EmailConsumer>(EmailConsumer);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(consumer).toBeDefined();
  });

  describe('process', () => {
    it('should process registration OTP job successfully', async () => {
      // Arrange
      const jobData: EmailJobData = {
        type: OtpType.REGISTRATION,
        email: 'test@example.com',
        otp: '123456',
      };

      const mockJob = {
        id: 'job-123',
        name: 'sendOtp',
        data: jobData,
      } as Job<EmailJobData, void, string>;

      mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);

      // Act
      await consumer.process(mockJob);

      // Assert
      expect(mockEmailService.sendRegistrationOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        otp: '123456',
      });
      expect(mockLogger.log).toHaveBeenCalledWith('Processing job job-123 of type sendOtp');
      expect(mockLogger.log).toHaveBeenCalledWith('Job job-123 completed successfully');
    });

    it('should process forgot password OTP job successfully', async () => {
      // Arrange
      const jobData = {
        type: OtpType.FORGOT_PASSWORD,
        email: 'test@example.com',
        otp: '789012',
        username: 'testuser',
      };

      const mockJob = {
        id: 'job-321',
        name: 'sendOtp',
        data: jobData,
      } as Job<EmailJobData, void, string>;

      mockEmailService.sendForgotPasswordOtp.mockResolvedValue(undefined);

      // Act
      await consumer.process(mockJob);

      // Assert
      expect(mockEmailService.sendForgotPasswordOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        otp: '789012',
        username: 'testuser',
      });
      expect(mockLogger.log).toHaveBeenCalledWith('Processing job job-321 of type sendOtp');
      expect(mockLogger.log).toHaveBeenCalledWith('Job job-321 completed successfully');
    });

    it('should throw error for unknown OTP type', async () => {
      // Arrange
      const jobData = {
        type: 'INVALID_TYPE',
        email: 'test@example.com',
        otp: '123456',
      };

      const mockJob = {
        id: 'job-invalid',
        name: 'sendOtp',
        data: jobData as unknown as EmailJobData,
      } as Job<EmailJobData, void, string>;

      // Act & Assert
      await expect(consumer.process(mockJob)).rejects.toThrow('Unknown OTP type');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Job job-invalid failed',
        expect.stringContaining('Unknown OTP type'),
      );
    });

    it('should process mixed job types independently', async () => {
      // Arrange
      const registrationJob = {
        id: 'job-reg',
        name: 'sendOtp',
        data: {
          type: OtpType.REGISTRATION,
          email: 'reg@example.com',
          otp: '111111',
        },
      } as Job<EmailJobData, void, string>;

      const forgotPasswordJob = {
        id: 'job-forgot',
        name: 'sendOtp',
        data: {
          type: OtpType.FORGOT_PASSWORD,
          email: 'forgot@example.com',
          otp: '222222',
          username: 'user',
        },
      } as Job<EmailJobData, void, string>;

      mockEmailService.sendRegistrationOtp.mockResolvedValue(undefined);
      mockEmailService.sendForgotPasswordOtp.mockResolvedValue(undefined);

      // Act
      await consumer.process(registrationJob);
      await consumer.process(forgotPasswordJob);

      // Assert
      expect(mockEmailService.sendRegistrationOtp).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendForgotPasswordOtp).toHaveBeenCalledTimes(1);
    });
  });
});
