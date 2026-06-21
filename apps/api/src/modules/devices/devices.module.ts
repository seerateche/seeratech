// ============================================================
// SEERA PLATFORM v4 - Devices Module
// ============================================================
import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { SecurityModule } from '../../security/security.module';

@Module({
  // SecurityModule is @Global, but importing it explicitly here makes the
  // SecurityService dependency of DevicesService visible in the module graph.
  imports: [SecurityModule],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
