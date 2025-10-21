import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { UAParser } from 'ua-parser-js';

export const DeviceType = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request: Request = ctx.switchToHttp().getRequest();
  const agentString = request.headers['user-agent'];
  const agent = UAParser(agentString);
  const browser = agent.browser;
  const os = agent.os;
  const device = agent.device;

  return `${browser.name || 'Unknown'} on ${os.name || 'Unknown'} (${device.type || 'Desktop'})`;
});
