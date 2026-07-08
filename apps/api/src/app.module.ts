// ============================================================
// SIRA PLATFORM v4 - Root App Module
// ============================================================
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from './common/response.interceptor';
import { DatabaseModule } from './database/database.module';
import { SecurityModule } from './security/security.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { DevicesModule } from './modules/devices/devices.module';
import { MikroTikModule } from './modules/mikrotik/mikrotik.module';
import { VouchersModule } from './modules/vouchers/vouchers.module';
import { ZkTecoModule } from './modules/zkteco/zkteco.module';
import { CctvModule } from './modules/cctv/cctv.module';
import { TerminalModule } from './modules/terminal/terminal.module';
import { IspTrackingModule } from './modules/isp-tracking/isp-tracking.module';
import { HealthModule } from './modules/health/health.module';
import { BillingModule } from './modules/billing/billing.module';

@Module({
  imports: [
    // Core
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    EventEmitterModule.forRoot({ wildcard: false, delimiter: '.' }),
    ScheduleModule.forRoot(),

    // Rate limiting: 100 requests per 60 seconds per IP
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60000,
        limit: 100,
      },
      {
        name: 'auth',
        ttl: 60000,
        limit: 10,
      },
    ]),

    // Infrastructure
    DatabaseModule,
    SecurityModule,

    // Health check (public, used by Railway/Docker healthcheck)
    HealthModule,

    // Feature modules
    // (AuthModule is @Global and provides JwtModule for the whole app)
    AuthModule,
    CompaniesModule,
    DevicesModule,
    MikroTikModule,
    VouchersModule,
    ZkTecoModule,
    CctvModule,
    TerminalModule,
    IspTrackingModule,
    BillingModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
