import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, RequestMethod } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
    bodyParser: false,
  });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Atrás do proxy do EasyPanel/Traefik: confia no 1º proxy para obter o IP
  // real do cliente (rate limiting e logs de rastreio corretos).
  app.set('trust proxy', 1);

  // Limite de payload (anti-DoS por corpo gigante).
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: false, limit: '2mb' }));

  // Rastreio (/t/...) e relatório público (/r/...) ficam na raiz, fora de /api.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 't/(.*)', method: RequestMethod.ALL },
      { path: 'r/(.*)', method: RequestMethod.ALL },
    ],
  });

  // Cabeçalhos de segurança. CSP restringe origens; 'unsafe-inline' é necessário
  // para os estilos/beacon das páginas de rastreio (conteúdo 100% nosso e
  // sanitizado). frame-ancestors/base-uri/form-action fecham vetores comuns.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'https:'],
          'connect-src': ["'self'"],
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
          'frame-ancestors': ["'none'"],
          'upgrade-insecure-requests': [],
        },
      },
      crossOriginEmbedderPolicy: false,
      // HSTS: força HTTPS por 1 ano.
      hsts: { maxAge: 31_536_000, includeSubDomains: true },
    }),
  );

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
