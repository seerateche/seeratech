// ============================================================
// SEERA PLATFORM v4 - Health Module
// ============================================================
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RootController } from './root.controller';

@Module({
  controllers: [HealthController, RootController],
})
export class HealthModule {}
