import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { StartRegistrationDto } from './dto/start-registration.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { AUTH_CONFIG } from 'src/common/constants/auth.constants';
import { DeviceType } from 'src/device/interfaces/device.interface';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { UnauthorizedException } from '@nestjs/common';
import { CheckIdentifierQueryDto } from './dtos';

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
};

describe('AuthController with real config service', () => {
  let controller: AuthController;
  let mockAuthService: Partial<AuthService>;

  beforeEach(async () => {
    mockAuthService = {
      verifyRecaptcha: jest.fn(),
      startRegistration: jest.fn(),
      verifyOtp: jest.fn(),
      completeRegistration: jest.fn(),
      resendOtp: jest.fn(),
      checkEmail: jest.fn(),
    };
  let config:ConfigService;

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ envFilePath: '.env.test', ignoreEnvFile: false })],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    config = module.get<ConfigService>(ConfigService);
  });

  describe('startRegistration', () => {
    const dto: StartRegistrationDto = {
      email: 'test@gmail.com',
      name: 'Test',
      birthDate: new Date(),
      recaptchaToken: 'valid-token',
    };

    it('should call the auth service and return a creation token if reCAPTCHA is valid', async () => {
      (mockAuthService.verifyRecaptcha as jest.Mock).mockResolvedValue(true);
      const serviceResult = { creationToken: 'new-token' };
      (mockAuthService.startRegistration as jest.Mock).mockResolvedValue(serviceResult);

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
      (mockAuthService.completeRegistration as jest.Mock).mockResolvedValue(serviceResult);

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
      (mockAuthService.verifyOtp as jest.Mock).mockResolvedValue(serviceResult);
      const result = await controller.verifyOtp(dto);
      expect(mockAuthService.verifyOtp).toHaveBeenCalledWith(dto);
      expect(result).toBe(serviceResult);
    });
  });

  describe('resendOtp', () => {
    it('should delegate to the auth service and return its result', async () => {
      const dto = { creationToken: 'token' };
      const serviceResult = { message: 'OTP resent successfully' };
      (mockAuthService.resendOtp as jest.Mock).mockResolvedValue(serviceResult);
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
      (mockAuthService.checkEmail as jest.Mock).mockResolvedValue(serviceResult);
      const result = await controller.checkEmail(dto);
      expect(mockAuthService.checkEmail).toHaveBeenCalledWith(dto.email);
      expect(result).toBe(serviceResult);
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

  describe('checkIdentifier', () => {
    it('it should call the checkIdentifier', async () => {
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
