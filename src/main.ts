import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-response.filter';
import cookieParser from 'cookie-parser';
import { AppLogger } from './logger/logger.service';
import { RedisService } from './redis/redis.service';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';

async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // buffers initial logs until winston is attached
    logger: isProd ? ['error', 'warn', 'log'] : ['debug', 'error', 'warn', 'log', 'verbose'],
  });

  app.use(cookieParser());
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

bootstrap().catch((err) => {
  console.error('Application failed to start:', err);
});
