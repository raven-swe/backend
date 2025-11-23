import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { SseService } from './sse.service';
import { JwtAuthGuard } from 'src/auth/guards';
import { User } from 'src/auth/decorators';
import type { RequestUser } from 'src/common/interfaces';
import { randomUUID } from 'crypto';

interface SseEvent {
  event?: string;
  id?: bigint;
  data: unknown;
}

const SSE_CONNECTION_TIMEOUT = 2 * 60 * 60 * 1000;

@Controller('stream')
export class SseController {
  constructor(private readonly sse: SseService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  stream(
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
    const connectionId = randomUUID();

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders?.();

    res.write(
      `event: connected\ndata: ${JSON.stringify({ ok: true, deviceId: connectionId })}\n\n`,
    );

    const subscription = this.sse.subscribe(userId, connectionId).subscribe((ev: SseEvent) => {
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
      this.sse.unsubscribe(userId, connectionId);
    });
  }
}
