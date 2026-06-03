// ============================================================
// SEERA PLATFORM v4 - CCTV Controller
// ============================================================
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CctvProxyService } from './cctv-proxy.service';
import { JwtAuthGuard } from '../auth/auth.service';

@ApiTags('cctv')
@ApiBearerAuth()
@Controller('cctv')
@UseGuards(JwtAuthGuard)
export class CctvController {
  constructor(private readonly cctv: CctvProxyService) {}

  @Post('start/:deviceId')
  start(@Param('deviceId', ParseUUIDPipe) deviceId: string) {
    return this.cctv.startStream(deviceId);
  }

  @Post('stop/:deviceId')
  async stop(@Param('deviceId', ParseUUIDPipe) deviceId: string) {
    await this.cctv.stopStream(deviceId);
    return { stopped: true };
  }

  @Get('active')
  active() {
    return this.cctv.getActiveStreams();
  }
}
