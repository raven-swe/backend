import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const getIPAddressFromContext = (data: unknown, ctx: ExecutionContext) => {
  const request: Request = ctx.switchToHttp().getRequest();

  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return request.socket.remoteAddress || '';
};

export const IPAddress = createParamDecorator(getIPAddressFromContext);
