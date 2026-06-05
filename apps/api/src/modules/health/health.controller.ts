// ============================================================
// SEERA PLATFORM v4 - Health Check Controller
// Exposed at GET /api/v1/health (global prefix is "api/v1").
// Used by Docker HEALTHCHECK and Railway's healthcheckPath.
// ============================================================
import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/auth.service';

@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  @Get()
  @Public()
  @SkipThrottle()
  check() {
    return {
      status: 'ok',
      service: 'seera-api',
      version: process.env.npm_package_version || '4.0.0',
      uptime: Math.round((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
  }
}
