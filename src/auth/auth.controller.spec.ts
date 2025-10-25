import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { StartRegistrationDto } from './dto/start-registration.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { AUTH_CONFIG } from './constants/auth.constants';
import { DeviceType } from 'src/devices/interfaces/device.interface';

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

  describe('startRegistration', () => {
    const dto: StartRegistrationDto = {
      email: 'test@gmail.com',
      name: 'Test',
      birthDate: new Date(),
      recaptchaToken: 'valid-token',
    };

    it('should call the auth service and return a creation token if reCAPTCHA is valid', async () => {
      mockAuthService.verifyRecaptcha.mockResolvedValue(true);
      const serviceResult = { creationToken: 'new-token' };
      mockAuthService.startRegistration.mockResolvedValue(serviceResult);

      const result = await controller.startRegistration(dto);

      expect(mockAuthService.startRegistration).toHaveBeenCalledWith(dto);
      expect(result).toBe(serviceResult);
    });
  });

  describe('completeRegistration', () => {
    const dto: CompleteRegistrationDto = {
      creationToken: 'test-token',
      password: 'pass',
    };

    const deviceType = DeviceType.WEB;

    const mockRequest = {
      ip: '127.0.0.1',
    } as Request;

    const mockResponse = {
      cookie: jest.fn(),
    } as unknown as Response;

    it('should call the service, set a cookie, and return the tokens', async () => {
      const serviceResult = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        message: 'Success',
      };
      mockAuthService.completeRegistration.mockResolvedValue(serviceResult);

      const result = await controller.completeRegistration(
        mockRequest,
        dto,
        deviceType,
        mockResponse,
      );

      expect(mockAuthService.completeRegistration).toHaveBeenCalledWith(
        dto,
        mockRequest.ip,
        deviceType,
      );

      expect((mockResponse.cookie as jest.Mock).mock.calls).toHaveLength(1);
      expect((mockResponse.cookie as jest.Mock).mock.calls[0]).toEqual([
        'refreshToken',
        serviceResult.refreshToken,
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: AUTH_CONFIG.REFRESH_TOKEN_TTL,
        },
      ]);

      expect(result).toEqual({
        accessToken: serviceResult.accessToken,
        refreshToken: serviceResult.refreshToken,
      });
    });
  });

  //im not sure if the following should be made at all but for coverage

  describe('verifyOtp', () => {
    it('should delegate to the auth service and return its result', async () => {
      const dto = { creationToken: 'token', otp: '123456' };
      const serviceResult = { message: 'OTP verified successfully' };

      mockAuthService.verifyOtp.mockResolvedValue(serviceResult);

      const result = await controller.verifyOtp(dto);
      expect(mockAuthService.verifyOtp).toHaveBeenCalledWith(dto);
      expect(result).toBe(serviceResult);
    });
  });

  describe('resendOtp', () => {
    it('should delegate to the auth service and return its result', async () => {
      const dto = { creationToken: 'token' };
      const serviceResult = { message: 'OTP resent successfully' };

      mockAuthService.resendOtp.mockResolvedValue(serviceResult);

      const result = await controller.resendOtp(dto);
      expect(mockAuthService.resendOtp).toHaveBeenCalledWith(dto.creationToken);
      expect(result).toBe(serviceResult);
    });
  });

  describe('checkEmail', () => {
    it('should delegate to the auth service and return its result', async () => {
      // ARRANGE
      const dto = { email: 'test@example.com' };
      const serviceResult = { message: 'email already exists', exists: true };

      mockAuthService.checkEmail.mockResolvedValue(serviceResult);

      const result = await controller.checkEmail(dto);
      expect(mockAuthService.checkEmail).toHaveBeenCalledWith(dto.email);
      expect(result).toBe(serviceResult);
    });
  });

  describe('Password Reset Flow', () => {
    describe('POST /auth/password/forgot', () => {
      const forgotPasswordDto = {
        identifier: 'test@example.com',
        recaptchaToken: 'valid-recaptcha-token',
      };

      it('should initiate forgot password process', async () => {
        // Arrange
        const expectedResult = { confirmationToken: 'token-123' };
        mockAuthService.forgotPassword.mockResolvedValue(expectedResult);

        // Act
        const result = await controller.forgotPassword(forgotPasswordDto);

        // Assert
        expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(forgotPasswordDto);
        expect(result).toEqual(expectedResult);
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
