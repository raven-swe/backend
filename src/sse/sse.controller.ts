import { Controller, Get, Logger, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { SseService } from './sse.service';
import { JwtAuthGuard } from 'src/auth/guards';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/common/interfaces';
import { SSE_CONNECTION_TIMEOUT } from './constants/sse-constants';

interface SseEvent {
  event?: string;
  id?: bigint;
  data: unknown;
}

@Controller('stream')
export class SseController {
  private readonly logger = new Logger(SseController.name);

  constructor(private readonly sse: SseService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async stream(
    @User() user: RequestUser,
    @Res({ passthrough: false }) res: Response,
    @Query('topics') topics?: string,
  ) {
    if (topics !== 'dm') {
      res.status(400).json({
        message: 'Invalid topics parameter. Only "dm" is supported.',
        code: 'INVALID_TOPICS',
      });
      return;
    }
    const userId = user.id;

    const subject = await this.sse.subscribe(userId);

    if (!subject) {
      this.logger.warn(`SSE connection limit reached - User: ${userId}`);
      res.status(429).json({
        message: 'Too many active connections. Close some tabs or devices.',
        code: 'TOO_MANY_CONNECTIONS',
      });
      return;
    }

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders?.();

    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    this.logger.log(
      `SSE client connected - User: ${userId}, Active connections (this pod): ${this.sse.getConnectionCount(
        userId,
      )}`,
    );

    const subscription = subject.asObservable().subscribe((ev: SseEvent) => {
      if (ev.event) res.write(`event: ${ev.event}\n`);
      if (ev.id) res.write(`id: ${ev.id}\n`);
      res.write(`data: ${JSON.stringify(ev.data)}\n\n`);
    });

    const ping = setInterval(() => {
      res.write(': ping\n\n');
    }, 25000);

    const connectionTimeout = setTimeout(() => {
      res.write(
        `event: session_expired\ndata: ${JSON.stringify({
          message: 'Connection expired after 2 hours. Please reconnect.',
        })}\n\n`,
      );
      res.end();
    }, SSE_CONNECTION_TIMEOUT);

    res.on('close', () => {
      clearInterval(ping);
      clearTimeout(connectionTimeout);
      subscription.unsubscribe();
      this.sse.unsubscribe(userId, subject);
      this.logger.log(
        `SSE client disconnected - User: ${userId}, Remaining connections (this pod): ${this.sse.getConnectionCount(userId)}`,
      );
    });
  }
}
