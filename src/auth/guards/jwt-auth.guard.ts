import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { OPTIONAL_AUTH_KEY } from 'src/common/decorators/optional-auth.decorator';
import { RequestUser } from 'src/common/interfaces';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, _info: any, context: ExecutionContext): any {
    const isOptional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (user) {
      return user as RequestUser;
    }

    if (isOptional) {
      return null;
    }

    throw (err as Error) || new UnauthorizedException();
  }
}
