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
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/auth.service';
import { CurrentUser } from '../../common/current-user.decorator';
import { AuthTokenPayload, UserRole } from '@sira/shared';

@ApiTags('cctv')
@ApiBearerAuth()
@Controller('cctv')
// Tenant isolation is enforced per-device inside CctvProxyService
// (assertDeviceOwned). RolesGuard additionally blocks the read-only `viewer`
// role from starting/stopping streams — only admins may control cameras.
@UseGuards(JwtAuthGuard, RolesGuard)
export class CctvController {
  constructor(private readonly cctv: CctvProxyService) {}

  @Post('start/:deviceId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  start(
    @CurrentUser() user: AuthTokenPayload,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    return this.cctv.startStream(deviceId, user);
  }

  @Post('stop/:deviceId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  async stop(
    @CurrentUser() user: AuthTokenPayload,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    await this.cctv.stopStream(deviceId, user);
    return { stopped: true };
  }

  @Get('active')
  active(@CurrentUser() user: AuthTokenPayload) {
    return this.cctv.getActiveStreams(user);
  }
}
