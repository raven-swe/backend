import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-response.filter';
import cookieParser from 'cookie-parser';
import { AppLogger } from './logger/logger.service';
import { RedisService } from './redis/redis.service';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';
import {
  MEDIA_STATIC_PREFIX,
  MEDIA_STORAGE_DRIVERS,
  resolveMediaStorageDriver,
} from './media/constants';
import { resolve } from 'path';

async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true, // buffers initial logs until winston is attached
    logger: isProd ? ['error', 'warn', 'log'] : ['debug', 'error', 'warn', 'log', 'verbose'],
  });

  app.use(cookieParser());

  serveLocalMedia(app);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      validationError: { target: false, value: false },
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => new BadRequestException(errors),
      forbidUnknownValues: false,
    }),
  );

  app.useLogger(app.get(AppLogger));
  app.useGlobalFilters(app.get(HttpExceptionFilter));

  const redisService = app.get(RedisService);

  const redisAdapter = new RedisIoAdapter(app, redisService);
  redisAdapter.connect();

  app.useWebSocketAdapter(redisAdapter);

  await app.listen(process.env.PORT ?? 3000);
}

function serveLocalMedia(app: NestExpressApplication): void {
  const configService = app.get(ConfigService);
  const driver = resolveMediaStorageDriver(configService.get<string>('MEDIA_STORAGE_DRIVER'));

  if (driver !== MEDIA_STORAGE_DRIVERS.LOCAL) return;

  const mediaRoot = resolve(configService.get<string>('MEDIA_ROOT') || './storage/media');

  app.useStaticAssets(mediaRoot, {
    prefix: MEDIA_STATIC_PREFIX,
    index: false,
    dotfiles: 'deny',
    maxAge: '1y',
    immutable: true,
  });

  new Logger('Bootstrap').log(`Serving media from ${mediaRoot} at ${MEDIA_STATIC_PREFIX}`);
}

bootstrap().catch((err) => {
  console.error('Application failed to start:', err);
});
