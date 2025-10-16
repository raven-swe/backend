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
import useragent from 'useragent';

const mockAuthService = {
  login: jest.fn(() =>
    Promise.resolve({
      access_token: 'mockAccessToken',
      refresh_token: 'mockRefreshToken',
    }),
  ),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'NODE_ENV') return 'production';
    if (key === 'ACCESS_TOKEN_EXPIRES_IN_SECONDS') return 900; // 15 minutes
    return null;
  }),
};

describe('AuthController', () => {
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

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
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
    it('should call authService.login, set a cookie, and return tokens', async () => {

      const mockUser = { id: '1', username: 'username' };
      const mockUserAgent = useragent.parse('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
      
      const mockResponse = {
        cookie: jest.fn(),
      } as unknown as Response;

      const result = await controller.login(mockUser, mockResponse, mockUserAgent.toString());

      expect(mockAuthService.login).toHaveBeenCalledWith(
        mockUser,
expect.objectContaining({
        os: expect.objectContaining({
          family: 'Windows',
        }) as unknown,
      }),      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockResponse.cookie).toHaveBeenCalledWith('jwt', 'mockAccessToken', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 900,
      });

      expect(result).toEqual({
        access_token: 'mockAccessToken',
        refresh_token: 'mockRefreshToken',
      });
    });
  });
});
