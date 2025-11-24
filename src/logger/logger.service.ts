import { Injectable, LoggerService, Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';

@Injectable()
// this is for use in the filter, where meta data like stack traces are needed
export class AppLogger implements LoggerService {
  constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: WinstonLogger) {}

  error(message: string, meta?: Record<string, unknown>) {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.logger.warn(message, meta);
  }

  log(message: string, meta?: Record<string, unknown>) {
    this.logger.info(message, meta);
  }
}
