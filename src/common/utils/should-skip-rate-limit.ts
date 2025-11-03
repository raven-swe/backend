import { ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/*
  Skip rate limiting in testing environment
*/
export function shouldSkipRateLimit(context: ExecutionContext): boolean {
  if (process.env.NODE_ENV !== 'testing') return false;

  const request = context.switchToHttp().getRequest<Request>();
  const secret = process.env.RATE_LIMIT_BYPASS_SECRET;

  const header = request.headers['x-bypass-rate-limit'];
  return typeof header === 'string' && header === secret;
}
