import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { OtpType } from './interfaces/email.interfaces';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('EmailService', () => {
  let service: EmailService;
  let mockTransporter: { sendMail: jest.Mock };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string | number> = {
        SMTP_HOST: 'smtp.test.com',
        SMTP_PORT: 587,
        SMTP_USER: 'test@test.com',
        SMTP_PASS: 'test-password',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    mockTransporter = {
      sendMail: jest.fn(),
    };

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should create transporter with correct SMTP configuration', () => {
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@test.com',
          pass: 'test-password',
        },
        tls: { rejectUnauthorized: false },
      });
    });

    it('should retrieve SMTP configuration from ConfigService', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('SMTP_HOST');
      expect(mockConfigService.get).toHaveBeenCalledWith('SMTP_PORT');
      expect(mockConfigService.get).toHaveBeenCalledWith('SMTP_USER');
      expect(mockConfigService.get).toHaveBeenCalledWith('SMTP_PASS');
    });
  });

  describe('sendRegistrationOtp', () => {
    const emailOtpJob = {
      email: 'test@example.com',
      otp: '123456',
    };

    it('should send registration OTP email successfully', async () => {
      // Arrange
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });

      // Act
      await service.sendRegistrationOtp(emailOtpJob);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"Raven Support" <no-reply@raven.com>',
        to: emailOtpJob.email,
        subject: 'Your One-Time Password (OTP) - Welcome to Raven',
        html: expect.stringContaining('Welcome to Raven!') as unknown as string,
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('123456') as unknown as string,
        }),
      );
    });

    it('should throw error when email sending fails', async () => {
      // Arrange
      const error = new Error('SMTP connection failed');
      mockTransporter.sendMail.mockRejectedValue(error);

      // Act & Assert
      await expect(service.sendRegistrationOtp(emailOtpJob)).rejects.toThrow(
        'SMTP connection failed',
      );
    });
  });

  describe('sendForgotPasswordOtp', () => {
    const forgotPasswordJob = {
      email: 'test@example.com',
      otp: '654321',
      username: 'test-user',
    };

    it('should send forgot password OTP email successfully', async () => {
      // Arrange
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });

      // Act
      await service.sendForgotPasswordOtp(forgotPasswordJob);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"Raven Support" <no-reply@raven.com>',
        to: forgotPasswordJob.email,
        subject: 'Your One-Time Password (OTP) - Password Reset',
        html: expect.stringContaining('Reset your password?') as unknown as string,
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('654321') as unknown as string,
        }),
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('test-user') as unknown as string,
        }),
      );
    });

    it('should throw error when email sending fails', async () => {
      // Arrange
      const error = new Error('Network error');
      mockTransporter.sendMail.mockRejectedValue(error);

      // Act & Assert
      await expect(service.sendForgotPasswordOtp(forgotPasswordJob)).rejects.toThrow(
        'Network error',
      );
    });
  });

  describe('sendEmail', () => {
    it('should send email with correct parameters', async () => {
      // Arrange
      const email = 'test@example.com';
      const subject = 'Test Subject';
      const html = '<p>Test HTML content</p>';
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });

      // Act
      await service.sendEmail(email, subject, html);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"Raven Support" <no-reply@raven.com>',
        to: email,
        subject,
        html,
      });
    });
  });

  describe('getOtpEmailTemplate', () => {
    it('should return correct template for REGISTRATION OTP', () => {
      // Act
      const template = service.getOtpEmailTemplate('123456', OtpType.REGISTRATION);

      // Assert
      expect(template.subject).toBe('Your One-Time Password (OTP) - Welcome to Raven');
      expect(template.html).toContain('Welcome to Raven!');
      expect(template.html).toContain('123456');
    });

    it('should return correct template for FORGOT_PASSWORD OTP', () => {
      // Act
      const template = service.getOtpEmailTemplate('654321', OtpType.FORGOT_PASSWORD, 'test-user');

      // Assert
      expect(template.subject).toBe('Your One-Time Password (OTP) - Password Reset');
      expect(template.html).toContain('Reset your password?');
      expect(template.html).toContain('654321');
      expect(template.html).toContain('test-user');
    });
  });
});
