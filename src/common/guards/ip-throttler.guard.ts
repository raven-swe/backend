import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class IpThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(IpThrottlerGuard.name);

  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as Request;

    const xClientIp = request.headers['x-client-ip'];

    const headerIp = Array.isArray(xClientIp) ? xClientIp[0] : xClientIp;

    const ip = headerIp || request.ip || request.socket?.remoteAddress || 'unknown';

    this.logger.log(`Receiving request from a client with IP: ${ip}`);

    return Promise.resolve(ip);
  }
}
