// ============================================================
// SIRA PLATFORM v4 - Main Application Bootstrap
// ============================================================
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as compression from 'compression';
import * as helmet from 'helmet';
import { AppModule } from './app.module';

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
    helmet.default({
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

  // CORS
  app.enableCors({
    origin: config.get('CORS_ORIGINS', 'http://localhost:5173').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Company-Slug'],
  });

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

  // ── Swagger Docs (dev only) ───────────────────────────────
  if (env !== 'production') {
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
    logger.log(`📚 Swagger docs available at: http://localhost:${port}/api/docs`);
  }

  await app.listen(port);

  logger.log(`🚀 Sira Platform API running on port ${port} [${env}]`);
  logger.log(`🔒 AES-256-GCM encryption: ACTIVE`);
  logger.log(`📡 WebSocket gateway: ws://localhost:${port}/ws`);
}

bootstrap().catch((err) => {
  console.error('Fatal: Failed to start Sira Platform:', err);
  process.exit(1);
});
