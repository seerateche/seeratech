// ============================================================
// SEERA PLATFORM v4 - ZKTeco / Attendance Module
// ============================================================
import { Module } from '@nestjs/common';
import { ZkService } from './zk.service';
import { AttendanceController } from './attendance.controller';

@Module({
  controllers: [AttendanceController],
  providers: [ZkService],
  exports: [ZkService],
})
export class ZkTecoModule {}
