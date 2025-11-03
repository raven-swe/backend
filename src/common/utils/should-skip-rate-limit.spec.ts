import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Request } from 'express';
import { shouldSkipRateLimit } from './should-skip-rate-limit';
import { ExecutionContext } from '@nestjs/common';

describe('shouldSkipRateLimit', () => {
  it('returns false in non-testing env', () => {
    process.env.NODE_ENV = 'production';
    const context = new ExecutionContextHost([{ headers: {} }]);

    expect(shouldSkipRateLimit(context)).toBe(false);
  });

  it('returns false if header missing', () => {
    process.env.NODE_ENV = 'testing';
    const context = new ExecutionContextHost([{ headers: {} }]);

    expect(shouldSkipRateLimit(context)).toBe(false);
  });

  it('returns true if env and header match', () => {
    process.env.NODE_ENV = 'testing';
    process.env.RATE_LIMIT_BYPASS_SECRET = 'test-secret';

    const mockRequest = { headers: { 'x-bypass-rate-limit': 'test-secret' } } as Partial<Request>;
    const context = new ExecutionContextHost([mockRequest]);

    expect(shouldSkipRateLimit(context as ExecutionContext)).toBe(true);
  });
});
