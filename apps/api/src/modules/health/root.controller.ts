// ============================================================
// SEERA PLATFORM v4 - Root Landing Controller
// Served at GET / (excluded from the global "api/v1" prefix).
// Avoids a bare "Cannot GET /" 404 when the service URL is opened
// directly; points clients at the health endpoint and API docs.
// ============================================================
import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/auth.service';

@Controller()
export class RootController {
  @Get()
  @Public()
  @SkipThrottle()
  root() {
    return {
      service: 'seera-api',
      version: process.env.npm_package_version || '4.0.0',
      status: 'ok',
      message: 'Seera Platform API v4 — see /api/v1/health',
      endpoints: {
        health: '/api/v1/health',
        api: '/api/v1',
        docs: process.env.NODE_ENV === 'production' ? null : '/api/docs',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
