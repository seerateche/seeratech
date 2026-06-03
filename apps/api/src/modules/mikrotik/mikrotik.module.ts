// ============================================================
// SEERA PLATFORM v4 - MikroTik Module
// ============================================================
import { Module } from '@nestjs/common';
import { MikroTikService } from './mikrotik.service';
import { MikroTikController } from './mikrotik.controller';

@Module({
  controllers: [MikroTikController],
  providers: [MikroTikService],
  exports: [MikroTikService],
})
export class MikroTikModule {}
