import { Test, TestingModule } from '@nestjs/testing';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { ExecutionContext, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { validateOrReject, ValidationError } from 'class-validator';
import { LoginDto } from './dtos';

jest.mock(
  'class-validator',
  () =>
    ({
      ...jest.requireActual('class-validator'),
      validateOrReject: jest.fn(),
    }) as unknown,
);

const superCanActivateSpy = jest.spyOn(AuthGuard('local').prototype, 'canActivate');

const mockedValidateOrReject = validateOrReject as jest.Mock;

const createMockContext = (body: unknown): ExecutionContext => {
  const mockRequest = {
    body: body,
  };
  const mockContext = {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
    }),
  };
  return mockContext as unknown as ExecutionContext;
};

describe('LocalAuthGuard', () => {
  let guard: LocalAuthGuard;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [LocalAuthGuard],
    }).compile();

    guard = module.get<LocalAuthGuard>(LocalAuthGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should throw BadRequestException if validation fails', async () => {
      const body = { identifier: 'test' };
      const mockContext = createMockContext(body);

      const validationError = new ValidationError();
      validationError.constraints = {
        isNotEmpty: 'password should not be empty',
      };
      const mockErrors = [validationError];

      mockedValidateOrReject.mockRejectedValue(mockErrors);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new BadRequestException(['password should not be empty']),
      );

      expect(superCanActivateSpy).not.toHaveBeenCalled();
    });

    it('should call super.canActivate and return true if validation succeeds', async () => {
      const body = { identifier: 'test', password: 'password123' };
      const mockContext = createMockContext(body);

      mockedValidateOrReject.mockResolvedValue(undefined);

      superCanActivateSpy.mockResolvedValue(true);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockedValidateOrReject).toHaveBeenCalledWith(expect.any(LoginDto));
      expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);
    });

    it('should re-throw generic errors if not a validation error', async () => {
      const body = { identifier: 'test', password: 'password123' };
      const mockContext = createMockContext(body);

      const genericError = new Error('Something bad happened');
      mockedValidateOrReject.mockRejectedValue(genericError);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(genericError);

      expect(superCanActivateSpy).not.toHaveBeenCalled();
    });
  });
});
