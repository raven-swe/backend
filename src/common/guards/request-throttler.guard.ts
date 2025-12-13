// common/guards/request-throttler.guard.ts
import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';
import { Request } from 'express';

@Injectable()
export class RequestThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(RequestThrottlerGuard.name);

  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context, throttler } = requestProps;
    this.logger.debug(`Processing request with throttler: ${throttler.name ?? 'default'}`);

    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;
    const throttlerName = throttler.name ?? 'default';

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      if (throttlerName === 'default') {
        return true; // Skip this specific throttler check
      }
    } else if (method === 'GET') {
      if (throttlerName === 'short') {
        return true; // Skip this specific throttler check
      }
    }

    return super.handleRequest(requestProps);
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as Request;

    const forwarded = request.headers['x-forwarded-for'];
    const headerIp = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined;

    const ip = headerIp || request.ip || request.socket?.remoteAddress || 'unknown';

    this.logger.debug(`Request from IP: ${ip}`);

    return Promise.resolve(ip);
  }
}
