import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { config } from './core/config/env.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Trust 1 reverse proxy hop (Caddy on host) so `request.ip` reads
  // X-Forwarded-For. Required by MulticardCallbackIpGuard (audit S-CRIT-4).
  app.set('trust proxy', 1);

  app.use(helmet());
  app.enableCors({
    origin: config.ALLOWED_ORIGINS,
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');

  const port = config.PORT;
  await app.listen(port);

  Logger.log(`Dorify API running on port ${port}`, 'Bootstrap');
}

bootstrap();
