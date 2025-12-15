import { Logger } from '@nestjs/common';
import { RequestThrottlerGuard } from '../../../src/common/guards/request-throttler.guard';
import { Reflector } from '@nestjs/core';
import { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { Request } from 'express';

describe('RequestThrottlerGuard', () => {
  let guard: RequestThrottlerGuard;

  beforeEach(() => {
    // Suppress logger output
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();

    // Create guard instance with minimal dependencies
    const mockOptions: ThrottlerModuleOptions = {
      throttlers: [{ name: 'default', ttl: 60, limit: 10 }],
    };
    const mockStorage: ThrottlerStorage = {
      increment: jest.fn(),
      reset: jest.fn(),
      get: jest.fn(),
    } as unknown as ThrottlerStorage;
    const mockReflector = new Reflector();

    guard = new RequestThrottlerGuard(mockOptions, mockStorage, mockReflector);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('getTracker', () => {
    it('should extract IP from x-forwarded-for header', async () => {
      const mockRequest = {
        headers: {
          'x-forwarded-for': '203.0.113.1, 198.51.100.1',
        },
        ip: '192.0.2.1',
        socket: { remoteAddress: '192.0.2.2' },
      } as unknown as Request;

      const result = await guard['getTracker'](mockRequest as unknown as Record<string, unknown>);

      expect(result).toBe('203.0.113.1');
    });

    it('should fallback to request.ip when x-forwarded-for not present', async () => {
      const mockRequest = {
        headers: {},
        ip: '192.0.2.1',
        socket: { remoteAddress: '192.0.2.2' },
      } as unknown as Request;

      const result = await guard['getTracker'](mockRequest as unknown as Record<string, unknown>);

      expect(result).toBe('192.0.2.1');
    });

    it('should fallback to socket.remoteAddress when request.ip not available', async () => {
      const mockRequest = {
        headers: {},
        socket: { remoteAddress: '192.0.2.2' },
      } as unknown as Request;

      const result = await guard['getTracker'](mockRequest as unknown as Record<string, unknown>);

      expect(result).toBe('192.0.2.2');
    });

    it('should return "unknown" when no IP source available', async () => {
      const mockRequest = {
        headers: {},
      } as unknown as Request;

      const result = await guard['getTracker'](mockRequest as unknown as Record<string, unknown>);

      expect(result).toBe('unknown');
    });

    it('should handle IPv6 addresses', async () => {
      const mockRequest = {
        headers: {
          'x-forwarded-for': '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
        },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request;

      const result = await guard['getTracker'](mockRequest as unknown as Record<string, unknown>);

      expect(result).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
    });

    it('should trim whitespace from x-forwarded-for IP', async () => {
      const mockRequest = {
        headers: {
          'x-forwarded-for': '  203.0.113.1  , 198.51.100.1',
        },
        ip: '192.0.2.1',
        socket: { remoteAddress: '192.0.2.2' },
      } as unknown as Request;

      const result = await guard['getTracker'](mockRequest as unknown as Record<string, unknown>);

      expect(result).toBe('203.0.113.1');
    });

    it('should handle x-forwarded-for with single IP', async () => {
      const mockRequest = {
        headers: {
          'x-forwarded-for': '203.0.113.1',
        },
        ip: '192.0.2.1',
        socket: { remoteAddress: '192.0.2.2' },
      } as unknown as Request;

      const result = await guard['getTracker'](mockRequest as unknown as Record<string, unknown>);

      expect(result).toBe('203.0.113.1');
    });

    it('should handle x-forwarded-for as array (edge case)', async () => {
      const mockRequest = {
        headers: {
          'x-forwarded-for': ['203.0.113.1', '198.51.100.1'],
        },
        ip: '192.0.2.1',
        socket: { remoteAddress: '192.0.2.2' },
      } as unknown as Request;

      // x-forwarded-for as array is not a string, so should fallback to request.ip
      const result = await guard['getTracker'](mockRequest as unknown as Record<string, unknown>);

      expect(result).toBe('192.0.2.1');
    });

    it('should handle empty x-forwarded-for header', async () => {
      const mockRequest = {
        headers: {
          'x-forwarded-for': '',
        },
        ip: '192.0.2.1',
        socket: { remoteAddress: '192.0.2.2' },
      } as unknown as Request;

      // Empty string is not a valid IP, so should fallback to request.ip
      const result = await guard['getTracker'](mockRequest as unknown as Record<string, unknown>);

      expect(result).toBe('192.0.2.1');
    });

    it('should handle localhost IP', async () => {
      const mockRequest = {
        headers: {
          'x-forwarded-for': '127.0.0.1',
        },
        ip: '192.0.2.1',
        socket: { remoteAddress: '192.0.2.2' },
      } as unknown as Request;

      const result = await guard['getTracker'](mockRequest as unknown as Record<string, unknown>);

      expect(result).toBe('127.0.0.1');
    });

    it('should prioritize x-forwarded-for over other sources', async () => {
      const mockRequest = {
        headers: {
          'x-forwarded-for': '203.0.113.1',
        },
        ip: '192.0.2.1',
        socket: { remoteAddress: '192.0.2.2' },
      } as unknown as Request;

      const result = await guard['getTracker'](mockRequest as unknown as Record<string, unknown>);

      expect(result).toBe('203.0.113.1');
      expect(result).not.toBe('192.0.2.1');
      expect(result).not.toBe('192.0.2.2');
    });
  });
});
