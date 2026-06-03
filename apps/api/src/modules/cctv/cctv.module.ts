// ============================================================
// SEERA PLATFORM v4 - CCTV Module
// ============================================================
import { Module } from '@nestjs/common';
import { CctvProxyService } from './cctv-proxy.service';
import { CctvController } from './cctv.controller';

@Module({
  controllers: [CctvController],
  providers: [CctvProxyService],
  exports: [CctvProxyService],
})
export class CctvModule {}
