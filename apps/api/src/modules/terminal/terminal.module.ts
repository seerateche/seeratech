// ============================================================
// SEERA PLATFORM v4 - Terminal / WebSocket Module
// ============================================================
import { Module } from '@nestjs/common';
import { AppGateway } from './app.gateway';
import { MikroTikModule } from '../mikrotik/mikrotik.module';

@Module({
  imports: [MikroTikModule],
  providers: [AppGateway],
  exports: [AppGateway],
})
export class TerminalModule {}
