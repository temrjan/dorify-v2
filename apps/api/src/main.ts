import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { config } from './core/config/env.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

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
