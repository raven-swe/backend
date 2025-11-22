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
      // catches uncaught exceptions and unhandled promise rejections before crash
      exceptionHandlers: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            process.env.NODE_ENV === 'production' ? winston.format.json() : winston.format.simple(),
          ),
        }),
      ],
      rejectionHandlers: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            process.env.NODE_ENV === 'production' ? winston.format.json() : winston.format.simple(),
          ),
        }),
      ],
      // exits in production so as to be restarted in a clean state
      exitOnError: process.env.NODE_ENV === 'production',
    }),
  ],
  exports: [WinstonModule],
})
export class LoggerModule {}
