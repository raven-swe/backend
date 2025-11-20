import { Module } from '@nestjs/common';
import { WinstonModule, utilities as nestWinstonUtil } from 'nest-winston';
import * as winston from 'winston';

@Module({
  imports: [
    WinstonModule.forRoot({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format:
        process.env.NODE_ENV === 'production'
          ? winston.format.combine(winston.format.timestamp(), winston.format.json())
          : winston.format.combine(winston.format.timestamp(), nestWinstonUtil.format.nestLike()),
      transports: [new winston.transports.Console()],
    }),
  ],
  exports: [WinstonModule],
})
export class LoggerModule {}
