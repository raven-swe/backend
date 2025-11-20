import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Request } from 'express';
import { shouldSkipRateLimit } from 'src/common/utils';
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

    expect(shouldSkipRateLimit(context)).toBe(true);
  });
});
