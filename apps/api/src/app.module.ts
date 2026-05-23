// ============================================================
// SIRA PLATFORM v4 - Root App Module
// ============================================================
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
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

    // JWT
    JwtModule.registerAsync({
      useFactory: (config: any) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: ['ConfigService'],
    }),

    // Infrastructure
    DatabaseModule,
    SecurityModule,

    // Feature modules
    AuthModule,
    CompaniesModule,
    DevicesModule,
    MikroTikModule,
    VouchersModule,
    ZkTecoModule,
    CctvModule,
    TerminalModule,
    IspTrackingModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
