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
@UseGuards(JwtAuthGuard, RolesGuard)
export class CctvController {
  constructor(private readonly cctv: CctvProxyService) {}

  @Post('start/:deviceId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.VIEWER)
  start(
    @CurrentUser() user: AuthTokenPayload,
    @Param('deviceId', ParseUUIDPipe) deviceId: string
  ) {
    return this.cctv.startStream(deviceId, user);
  }

  @Post('stop/:deviceId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.VIEWER)
  async stop(
    @CurrentUser() user: AuthTokenPayload,
    @Param('deviceId', ParseUUIDPipe) deviceId: string
  ) {
    await this.cctv.stopStream(deviceId);
    return { stopped: true };
  }

  @Get('active')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.VIEWER)
  active(@CurrentUser() user: AuthTokenPayload) {
    return this.cctv.getActiveStreams(user);
  }
}
