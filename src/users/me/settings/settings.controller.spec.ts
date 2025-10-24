import { Test, TestingModule } from '@nestjs/testing';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { InititateEmailUpdateDto } from 'src/users/dtos/initiate-email-update.dto';
import { VerifyEmailUpdateDto } from 'src/users/dtos/verify-email-update.dto';
import { ResendEmailUpdateOtp } from 'src/users/dtos/resend-email-update-otp.dto';

describe('SettingsController', () => {
  let controller: SettingsController;

  const mockSettingsService = {
    checkNewEmail: jest.fn(),
    verifyEmailUpdate: jest.fn(),
    resendEmailUpdateOtp: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
      ],
    }).compile();

    controller = module.get<SettingsController>(SettingsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('inititateEmailUpdate', () => {
    it('should initiate email update successfully', async () => {
      const dto: InititateEmailUpdateDto = {
        newEmail: 'newemail@example.com',
      };
      const userId = BigInt(1);
      const expectedResult = { confirmationToken: 'test-token-123' };

      mockSettingsService.checkNewEmail.mockResolvedValue(expectedResult);

      const result = await controller.inititateEmailUpdate(dto);

      expect(mockSettingsService.checkNewEmail).toHaveBeenCalledWith(userId, dto);
      expect(result).toEqual(expectedResult);
    });

    it('should handle errors from service', async () => {
      const dto: InititateEmailUpdateDto = {
        newEmail: 'existing@example.com',
      };
      const error = new Error('Email already in use');

      mockSettingsService.checkNewEmail.mockRejectedValue(error);

      await expect(controller.inititateEmailUpdate(dto)).rejects.toThrow(error);
    });
  });

  describe('verifyUpdateEmailOtp', () => {
    it('should verify email update OTP successfully', async () => {
      const dto: VerifyEmailUpdateDto = {
        confirmationToken: 'test-token-123',
        otp: '123456',
      };
      const userId = BigInt(1);
      const expectedResult = { message: 'Email address updated successfully.' };

      mockSettingsService.verifyEmailUpdate.mockResolvedValue(expectedResult);

      const result = await controller.verifyUpdateEmailOtp(dto);

      expect(mockSettingsService.verifyEmailUpdate).toHaveBeenCalledWith(userId, dto);
      expect(result).toEqual(expectedResult);
    });

    it('should handle invalid OTP', async () => {
      const dto: VerifyEmailUpdateDto = {
        confirmationToken: 'test-token-123',
        otp: 'wrongotp',
      };
      const error = new Error('Invalid OTP');

      mockSettingsService.verifyEmailUpdate.mockRejectedValue(error);

      await expect(controller.verifyUpdateEmailOtp(dto)).rejects.toThrow(error);
    });

    it('should handle invalid confirmation token', async () => {
      const dto: VerifyEmailUpdateDto = {
        confirmationToken: 'invalid-token',
        otp: '123456',
      };
      const error = new Error('Invalid token');

      mockSettingsService.verifyEmailUpdate.mockRejectedValue(error);

      await expect(controller.verifyUpdateEmailOtp(dto)).rejects.toThrow(error);
    });
  });

  describe('resendUpdateEmailOtp', () => {
    it('should resend email update OTP successfully', async () => {
      const dto: ResendEmailUpdateOtp = {
        confirmationToken: 'test-token-123',
      };
      const userId = BigInt(1);
      const expectedResult = { message: 'OTP resent successfully' };

      mockSettingsService.resendEmailUpdateOtp.mockResolvedValue(expectedResult);

      const result = await controller.resendUpdateEmailOtp(dto);

      expect(mockSettingsService.resendEmailUpdateOtp).toHaveBeenCalledWith(userId, dto);
      expect(result).toEqual(expectedResult);
    });

    it('should handle errors when resending OTP', async () => {
      const dto: ResendEmailUpdateOtp = {
        confirmationToken: 'invalid-token',
      };
      const error = new Error('Token expired');

      mockSettingsService.resendEmailUpdateOtp.mockRejectedValue(error);

      await expect(controller.resendUpdateEmailOtp(dto)).rejects.toThrow(error);
    });

    it('should handle rate limiting scenarios', async () => {
      const dto: ResendEmailUpdateOtp = {
        confirmationToken: 'test-token-123',
      };
      const error = new Error('Too many requests');

      mockSettingsService.resendEmailUpdateOtp.mockRejectedValue(error);

      await expect(controller.resendUpdateEmailOtp(dto)).rejects.toThrow(error);
    });
  });

  describe('controller constants', () => {
    it('should have correct EMAIL_UPDATE_LIMIT', () => {
      expect(SettingsController['EMAIL_UPDATE_LIMIT']).toBe(5);
    });

    it('should have correct EMAIL_UPDATE_WINDOW', () => {
      expect(SettingsController['EMAIL_UPDATE_WINDOW']).toBe(60000);
    });
  });
});
