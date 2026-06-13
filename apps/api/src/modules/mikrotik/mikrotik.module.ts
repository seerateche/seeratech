// ============================================================
// SEERA PLATFORM v4 - MikroTik Module
// ============================================================
import { Module } from '@nestjs/common';
import { MikroTikService } from './mikrotik.service';
import { MikroTikController } from './mikrotik.controller';
import { MikroTikRealtimeGateway } from './mikrotik-realtime.gateway';

@Module({
  controllers: [MikroTikController],
  providers: [MikroTikService, MikroTikRealtimeGateway],
  exports: [MikroTikService],
})
export class MikroTikModule {}
