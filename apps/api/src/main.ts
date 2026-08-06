import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Rastreio (/t/...) e relatório público (/r/...) ficam na raiz, fora de /api.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 't/(.*)', method: RequestMethod.ALL },
      { path: 'r/(.*)', method: RequestMethod.ALL },
    ],
  });
  // helmet com CSP desativado: as landings usam estilos inline.
  app.use(helmet({ contentSecurityPolicy: false }));

  const origins = config
    .getOrThrow<string>('CORS_ORIGIN')
    .split(',')
    .map((o) => o.trim());
  app.enableCors({ origin: origins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableShutdownHooks();

  const port = config.getOrThrow<number>('API_PORT');
  await app.listen(port, '0.0.0.0');
  logger.log(`API no ar em http://0.0.0.0:${port}/api`);
}

bootstrap();
