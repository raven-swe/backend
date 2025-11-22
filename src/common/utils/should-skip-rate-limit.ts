import { ExecutionContext } from '@nestjs/common';
/*
  Skip rate limiting in testing environment
*/
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function shouldSkipRateLimit(context: ExecutionContext): boolean {
  if (process.env.NODE_ENV === 'testing') return true;
  return false;
}
