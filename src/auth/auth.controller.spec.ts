import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { StartRegistrationDto } from './dto/start-registration.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { AUTH_CONFIG } from './constants/auth.constants';
import { DeviceType } from 'src/devices/interfaces/device.interface';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { CheckIdentifierQueryDto } from './dtos';
import { RequestWithCookies } from './types';
import { RefreshTokenDto } from './dtos';

const mockAuthService = {
  login: jest.fn(() =>
    Promise.resolve({
      accessToken: 'mockAccessToken',
      refreshToken: 'mockRefreshToken',
    }),
  ),
  checkIdentifier: jest.fn(() =>
    Promise.resolve({
      exists: true,
      type: 'username',
    }),
  ),
  refreshAccessToken: jest.fn(() =>
    Promise.resolve({
      accessToken: 'mockAccessToken',
      refreshToken: 'mockRefreshToken',
    }),
  ),
};
function mockRequestWithCookies(
  cookies: Record<string, string | undefined> = {},
): RequestWithCookies {
  return {
    cookies,
  } as unknown as RequestWithCookies;
}

describe('AuthController with real config service', () => {
  describe('AuthController', () => {
    let controller: AuthController;
    let config: ConfigService;

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
    login: jest.fn(() =>
      Promise.resolve({
        accessToken: 'mockAccessToken',
        refreshToken: 'mockRefreshToken',
      }),
    ),
    checkIdentifier: jest.fn(() =>
      Promise.resolve({
        exists: true,
        type: 'username',
      }),
    ),
  };

  let config: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ envFilePath: '.env.test', ignoreEnvFile: false })],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    config = module.get<ConfigService>(ConfigService);

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

  describe('login', () => {
    const mockDeviceType = 'Chrome On Windows (Desktop)';
    const ipAddress = '192.33.100.1';
    let mockClientType: 'web' | 'mobile' = 'web';
    const mockResponse = {
      cookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
    } as unknown as Response;
    const mockUser = { id: '1', username: 'username' };

    it('with client type undefined should throw UnauthorizedException', async () => {
      await expect(
        controller.login(mockUser, ipAddress, mockDeviceType, mockResponse, undefined as never),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    describe('login', () => {
      const mockDeviceType = 'Chrome On Windows (Desktop)';
      const ipAddress = '192.33.100.1';
      let mockClientType: 'web' | 'mobile' = 'web';
      const mockResponse = {
        cookie: jest.fn(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;
      const mockUser = { id: '1', username: 'username' };

      it('with client type undefined should call authService.login and return refreshToken', async () => {
        await expect(
          controller.login(mockUser, ipAddress, mockDeviceType, mockResponse, undefined as never),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('with client type mobile should call authService.login and return refreshToken', async () => {
        mockClientType = 'mobile';
        const result = await controller.login(
          mockUser,
          ipAddress,
          mockDeviceType,
          mockResponse,
          mockClientType,
        );
        expect(mockAuthService.login).toHaveBeenCalledWith(mockUser, mockDeviceType, ipAddress);
        expect(result).toEqual({
          accessToken: 'mockAccessToken',
          refreshToken: 'mockRefreshToken',
        });
      });
      it('with client type web should call authService.login, set a cookie', async () => {
        const mockClientType = 'web';
        mockResponse.status(200);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockResponse.status).toHaveBeenCalledWith(200);

        const result = await controller.login(
          mockUser,
          ipAddress,
          mockDeviceType,
          mockResponse,
          mockClientType,
        );

        expect(mockAuthService.login).toHaveBeenCalledWith(mockUser, mockDeviceType, ipAddress);

        const daysToMillis = 24 * 60 * 60 * 1000;
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockResponse.cookie).toHaveBeenCalledWith('refresh_token', 'mockRefreshToken', {
          httpOnly: true,
          secure: config.get('NODE_ENV') === 'production',
          sameSite: 'none',
          maxAge: config.get('REFRESH_TOKEN_EXPIRES_IN_DAYS') * daysToMillis,
        });

        expect(result).toEqual({
          accessToken: 'mockAccessToken',
        });
      });

      it('should throw an UnauthorizedException if login fails', async () => {
        mockAuthService.login.mockRejectedValueOnce(new UnauthorizedException());

        await expect(
          controller.login(mockUser, ipAddress, mockDeviceType, mockResponse, mockClientType),
        ).rejects.toThrow(UnauthorizedException);
      });
    });

    it('should throw an UnauthorizedException if login fails', async () => {
      (mockAuthService.login as jest.Mock).mockRejectedValueOnce(new UnauthorizedException());

        expect(mockAuthService.checkIdentifier).toHaveBeenCalled();
        expect(mockAuthService.checkIdentifier).toHaveBeenCalledWith(dto.identifier);

  describe('checkIdentifier', () => {
    it('it should call the checkIdentifier', async () => {
      (mockAuthService.checkIdentifier as jest.Mock).mockResolvedValue({
        exists: true,
        type: 'username',
      });

      const dto: CheckIdentifierQueryDto = { identifier: 'test' };
      const result = await controller.checkIdentifier(dto);

      expect(mockAuthService.checkIdentifier).toHaveBeenCalled();
      expect(mockAuthService.checkIdentifier).toHaveBeenCalledWith(dto.identifier);

      expect(result).toStrictEqual({ exists: true, type: 'username' });
    });
  });
});

describe('AuthController with mocked config service', () => {
  const mockConfigService = {
    get: jest.fn(),
  };
  let mockAuthService: Partial<AuthService>;

  let controller: AuthController;

  beforeEach(async () => {
    mockAuthService = {
      login: jest.fn(() =>
        Promise.resolve({
          accessToken: 'mockAccessToken',
          refreshToken: 'mockRefreshToken',
        }),
      ),
      checkIdentifier: jest.fn(() =>
        Promise.resolve({
          exists: true,
          type: 'username',
        }),
      ),
    };
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ envFilePath: '.env.test', ignoreEnvFile: false })],
      controllers: [AuthController],
      providers: [
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    config = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
  const mockDeviceType = 'Chrome On Windows (Desktop)';
  const mockClientType = 'web';
  const ipAddress = '192.33.100.1';
  const mockResponse = {
    cookie: jest.fn(),
    status: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const mockUser = { id: '1', username: 'username' };

  it('should fallback to default value when config serivce cant get value', async () => {
    const result = await controller.login(
      mockUser,
      ipAddress,
      mockDeviceType,
      mockResponse,
      mockClientType,
    );

    expect(mockAuthService.login).toHaveBeenCalledWith(mockUser, mockDeviceType, ipAddress);

    const daysToMillis = 24 * 60 * 60 * 1000;
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockResponse.cookie).toHaveBeenCalledWith('refresh_token', 'mockRefreshToken', {
      httpOnly: true,
      secure: false,
      sameSite: 'none',
      maxAge: 30 * daysToMillis,
    });

    if (mockClientType === 'web') {
      expect(result).toEqual({
        accessToken: 'mockAccessToken',
      });
    } else {
      expect(result).toEqual({
        accessToken: 'mockAccessToken',
        refreshToken: 'mockRefreshToken',
      });
    }
  });
});

describe('AuthController with mocked config service', () => {
  const mockConfigService = {
    get: jest.fn(),
  };

  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
  const mockDeviceType = 'Chrome On Windows (Desktop)';
  const mockClientType = 'web';
  const ipAddress = '192.33.100.1';
  const mockResponse = {
    cookie: jest.fn(),
    status: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const mockUser = { id: '1', username: 'username' };
  describe('login', () => {
    it('should fallback to default value when config serivce cant get value', async () => {
      const result = await controller.login(
        mockUser,
        ipAddress,
        mockDeviceType,
        mockResponse,
        mockClientType,
      );

      expect(mockAuthService.login).toHaveBeenCalledWith(mockUser, mockDeviceType, ipAddress);

      const daysToMillis = 24 * 60 * 60 * 1000;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockResponse.cookie).toHaveBeenCalledWith('refresh_token', 'mockRefreshToken', {
        httpOnly: true,
        secure: false,
        sameSite: 'none',
        maxAge: 30 * daysToMillis,
      });

      expect(result).toEqual({
        accessToken: 'mockAccessToken',
      });
    });
  });
  describe('refreshToken', () => {
    let mockClientType: 'web' | 'mobile' = 'web';
    const refreshToken = 'old_mocked_refresh_token';
    const req = mockRequestWithCookies({ refresh_token: refreshToken });
    const dto: RefreshTokenDto = { refresh_token: refreshToken };
    const mockResponse = {
      cookie: jest.fn(),
    } as unknown as Response;
    it('for client type web should call authService.refreshAccessToken', async () => {
      const result = await controller.refrehAccessToken(req, dto, mockResponse, mockClientType);

      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith(refreshToken);
      const daysToMillis = 24 * 60 * 60 * 1000;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockResponse.cookie).toHaveBeenCalledWith('refresh_token', 'mockRefreshToken', {
        httpOnly: true,
        secure: false,
        sameSite: 'none',
        maxAge: 30 * daysToMillis,
      });

      expect(result).toEqual({
        accessToken: 'mockAccessToken',
      });
    });
    it('for client type mobile should call authService.refreshAccessToken, set a cookie and return tokens', async () => {
      mockClientType = 'mobile';

      const result = await controller.refrehAccessToken(req, dto, mockResponse, mockClientType);

      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith(refreshToken);

      expect(result).toEqual({
        accessToken: 'mockAccessToken',
        refreshToken: 'mockRefreshToken',
      });
    });
    it('with client type undefined should throw', async () => {
      await expect(
        controller.refrehAccessToken(req, dto, mockResponse, undefined as never),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('with undefined refresh_token in body it should throw', async () => {
      mockClientType = 'mobile';
      await expect(
        controller.refrehAccessToken(req, undefined as never, mockResponse, undefined as never),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('with undefined refresh_token in cookie it should throw', async () => {
      const noCookieReq = mockRequestWithCookies({ refresh_token: undefined });

      await expect(
        controller.refrehAccessToken(
          noCookieReq,
          undefined as never,
          mockResponse,
          undefined as never,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
