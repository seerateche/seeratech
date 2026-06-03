// ============================================================
// SEERA PLATFORM v4 - Vouchers Module
// ============================================================
import { Module } from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { VoucherPdfService } from './voucher-pdf.service';
import { VouchersController } from './vouchers.controller';
import { MikroTikModule } from '../mikrotik/mikrotik.module';

@Module({
  imports: [MikroTikModule],
  controllers: [VouchersController],
  providers: [VouchersService, VoucherPdfService],
  exports: [VouchersService],
})
export class VouchersModule {}
