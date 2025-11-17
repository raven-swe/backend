import { ExecutionContext } from '@nestjs/common';
import { getDeviceTypeFromContext } from 'src/auth/decorators';

describe('Device Type Decorator Logic', () => {
  it('should extract the device-type from the execution context', () => {
    const mockRequest = {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36',
      },
    };

    const expectedResult = 'Chrome on Windows (Desktop)';

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;

    const result = getDeviceTypeFromContext(null, mockContext);

    expect(result).toBe(expectedResult);
  });
});
