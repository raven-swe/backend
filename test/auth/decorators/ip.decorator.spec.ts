import { ExecutionContext } from '@nestjs/common';
import { getIPAddressFromContext } from 'src/auth/decorators';

describe('IP Decorator Logic', () => {
  it('should extract the ip from the execution context headers', () => {
    const mockRequest = {
      headers: {
        'x-forwarded-for': '1.1.1.1, 2.2.2.2',
      },
      socket: {
        remoteAddress: '2.2.2.2',
      },
    };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;

    const result = getIPAddressFromContext(null, mockContext);

    expect(result).toBe('1.1.1.1');
  });

  it('should extract the ip from the execution context socket', () => {
    const mockRequest = {
      headers: {},
      socket: {
        remoteAddress: '2.2.2.2',
      },
    };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;

    const result = getIPAddressFromContext(null, mockContext);

    expect(result).toBe('2.2.2.2');
  });
  it('should return empty string if ip not found in headers and socket', () => {
    const mockRequest = {
      headers: {},
      socket: {},
    };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;

    const result = getIPAddressFromContext(null, mockContext);

    expect(result).toBe('');
  });
});
