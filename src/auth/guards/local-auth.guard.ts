import { Injectable, ExecutionContext, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { validateOrReject, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Request } from 'express';
import { LoginDto } from '../dtos';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();

    const rawBody: unknown = request.body;
    const body = rawBody && typeof rawBody === 'object' ? rawBody : {};
    const dto = plainToInstance(LoginDto, body);

    try {
      await validateOrReject(dto);
    } catch (errors) {
      if (Array.isArray(errors) && errors.every((e) => e instanceof ValidationError)) {
        throw new BadRequestException({
          message: errors,
          error: 'Bad Request',
          statusCode: 400,
        });
      }
      throw errors;
    }

    return (await super.canActivate(context)) as boolean;
  }
}
