import { ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/*
  Skip rate limiting in testing environment
*/
export function shouldSkipRateLimit(context: ExecutionContext): boolean {
  if (process.env.NODE_ENV === 'testing') return true;
  return false;
}
