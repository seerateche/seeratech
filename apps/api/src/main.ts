// ============================================================
// SIRA PLATFORM v4 - Main Application Bootstrap
// ============================================================
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { getCorsConfig, isOriginAllowed } from './common/cors-origin';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3001);
  const env = config.get<string>('NODE_ENV', 'development');

  // ── Security Middleware ──────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          mediaSrc: ["'self'", 'blob:'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(compression());

  // ── CORS ──────────────────────────────────────────────────
  // The single most common reason logins "silently fail" in production is a
  // CORS mismatch: the browser blocks the request because the API's allowed
  // origin list does not include the web app's deployed domain.
  //
  // Behaviour:
  //  - Explicit allow-list from CORS_ORIGINS (comma-separated), always honoured.
  //  - Any *.railway.app / *.up.railway.app origin is allowed automatically so
  //    a fresh Railway deploy works even before CORS_ORIGINS is configured.
  //  - Requests with no Origin header (curl, mobile apps, health checks,
  //    same-origin) are allowed.
  //  - Set CORS_ALLOW_ALL=true to allow every origin (use only for debugging).
  const { origins: corsOrigins, allowAll } = getCorsConfig();

  app.enableCors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin, corsOrigins, allowAll)) {
        return callback(null, true);
      }
      logger.warn(`🚫 CORS blocked origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Company-Slug', 'x-company-id'],
  });
  logger.log(
    `🌐 CORS allow-list: ${corsOrigins.join(', ') || '(none)'}${
      allowAll ? ' + ALL (debug)' : ' + *.railway.app'
    }`,
  );

  // ── Global Pipes ──────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── API Prefix ────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── Swagger Docs ────────────────────────────────────────────
  // Enabled in non-production OR when ENABLE_SWAGGER=true (Railway).
  if (env !== 'production' || config.get('ENABLE_SWAGGER') === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Sira Platform API v4')
      .setDescription('Enterprise ISP & Device Management Platform')
      .setVersion('4.0.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication')
      .addTag('companies', 'Multi-tenant Company Management')
      .addTag('devices', 'Device Management')
      .addTag('mikrotik', 'MikroTik Router Control')
      .addTag('vouchers', 'Hotspot Voucher Engine')
      .addTag('attendance', 'ZKTeco Biometric Attendance')
      .addTag('cctv', 'CCTV Streaming')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log(`📚 Swagger docs available at /api/docs`);
  }

  // Enable graceful shutdown hooks so onModuleDestroy handlers run on
  // SIGTERM/SIGINT (Railway sends SIGTERM on redeploy/scale-down). This lets
  // pooled MikroTik sockets and other resources close cleanly.
  app.enableShutdownHooks();

  // Bind to 0.0.0.0 so the service is reachable inside Docker / Railway
  // (binding to localhost would make the container unreachable externally).
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Sira Platform API running on port ${port} [${env}]`);
  logger.log(`🔒 AES-256-GCM encryption: ACTIVE`);
  logger.log(`📡 WebSocket gateway: ws://localhost:${port}/ws`);
}

bootstrap().catch((err) => {
  console.error('Fatal: Failed to start Sira Platform:', err);
  process.exit(1);
});
