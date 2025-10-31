import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { RequestUser } from '../types';

export const getUserFromContext = (
  data: keyof RequestUser | undefined,
  ctx: ExecutionContext,
): RequestUser[keyof RequestUser] | RequestUser | undefined => {
  const request: Request = ctx.switchToHttp().getRequest();
  const user = request.user as RequestUser | undefined;
  if (!user) {
    return undefined;
  }
  return data ? user[data] : user;
};

export const User = createParamDecorator(getUserFromContext);
