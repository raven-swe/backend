import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RecaptchaFailedException } from './exceptions/recaptcha.exception';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    verifyRecaptcha: jest.fn(),
    startRegistration: jest.fn(),
    verifyOtp: jest.fn(),
    completeRegistration: jest.fn(),
    resendOtp: jest.fn(),
    checkEmail: jest.fn(),
    forgotPassword: jest.fn(),
    verifyForgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    resendPasswordOtp: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Password Reset Flow', () => {
    describe('POST /auth/password/forgot', () => {
      const forgotPasswordDto = {
        identifier: 'test@example.com',
        recaptchaToken: 'valid-recaptcha-token',
      };

      it('should initiate password reset when recaptcha is valid', async () => {
        // Arrange
        const expectedResult = { confirmationToken: 'token-123' };
        mockAuthService.verifyRecaptcha.mockResolvedValue(true);
        mockAuthService.forgotPassword.mockResolvedValue(expectedResult);

        // Act
        const result = await controller.forgotPassword(forgotPasswordDto);

        // Assert
        expect(mockAuthService.verifyRecaptcha).toHaveBeenCalledWith(
          forgotPasswordDto.recaptchaToken,
        );
        expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(forgotPasswordDto);
        expect(result).toEqual(expectedResult);
      });

      it('should throw RecaptchaFailedException when recaptcha is invalid', async () => {
        // Arrange
        mockAuthService.verifyRecaptcha.mockResolvedValue(false);

        // Act & Assert
        await expect(controller.forgotPassword(forgotPasswordDto)).rejects.toThrow(
          RecaptchaFailedException,
        );
        expect(mockAuthService.verifyRecaptcha).toHaveBeenCalledWith(
          forgotPasswordDto.recaptchaToken,
        );
        expect(mockAuthService.forgotPassword).not.toHaveBeenCalled();
      });
    });

    describe('POST /auth/password/forgot/verify', () => {
      const verifyForgotPasswordDto = {
        confirmationToken: 'token-123',
        otp: '123456',
      };

      it('should verify OTP for password reset', async () => {
        // Arrange
        const expectedResult = { message: 'Password reset verified successfully.' };
        mockAuthService.verifyForgotPassword.mockResolvedValue(expectedResult);

        // Act
        const result = await controller.verifyForgotPasswordOtp(verifyForgotPasswordDto);

        // Assert
        expect(mockAuthService.verifyForgotPassword).toHaveBeenCalledWith(verifyForgotPasswordDto);
        expect(result).toEqual(expectedResult);
      });
    });

    describe('POST /auth/password/reset', () => {
      const resetPasswordDto = {
        confirmationToken: 'token-123',
        newPassword: 'NewSecurePassword!23',
      };

      it('should reset the password', async () => {
        // Arrange
        const expectedResult = { message: 'Password has been reset successfully.' };
        mockAuthService.resetPassword.mockResolvedValue(expectedResult);

        // Act
        const result = await controller.resetPassword(resetPasswordDto);

        // Assert
        expect(mockAuthService.resetPassword).toHaveBeenCalledWith(resetPasswordDto);
        expect(result).toEqual(expectedResult);
      });
    });

    describe('POST /auth/password/forgot/resend-otp', () => {
      const resendPasswordOtpDto = {
        confirmationToken: 'token-123',
      };

      it('should resend OTP for password reset', async () => {
        // Arrange
        const expectedResult = { message: 'OTP has been resent successfully.' };
        mockAuthService.resendPasswordOtp.mockResolvedValue(expectedResult);

        // Act
        const result = await controller.resendPasswordOtp(resendPasswordOtpDto);

        // Assert
        expect(mockAuthService.resendPasswordOtp).toHaveBeenCalledWith(resendPasswordOtpDto);
        expect(result).toEqual(expectedResult);
      });
    });
  });
});
