// ============================================================
// SEERA PLATFORM v4 - MikroTik Controller
// ============================================================
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { MikroTikService } from './mikrotik.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/auth.service';
import { UserRole } from '@sira/shared';

export class CpeCommandBody {
  @IsString() cpeIp: string;
  @IsString() command: string;
  @IsOptional() @IsObject() params?: Record<string, string>;
}

@ApiTags('mikrotik')
@ApiBearerAuth()
@Controller('mikrotik')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MikroTikController {
  constructor(private readonly mikrotik: MikroTikService) {}

  @Get(':deviceId/stats')
  stats(@Param('deviceId', ParseUUIDPipe) deviceId: string) {
    return this.mikrotik.getSystemStats(deviceId);
  }

  @Get(':deviceId/hotspot/profiles')
  profiles(@Param('deviceId', ParseUUIDPipe) deviceId: string) {
    return this.mikrotik.getHotspotProfiles(deviceId);
  }

  @Get(':deviceId/hotspot/active')
  activeUsers(@Param('deviceId', ParseUUIDPipe) deviceId: string) {
    return this.mikrotik.getActiveHotspotUsers(deviceId);
  }

  @Post(':deviceId/hotspot/kick/:activeId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  async kick(
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Param('activeId') activeId: string,
  ) {
    await this.mikrotik.kickHotspotUser(deviceId, activeId);
    return { kicked: true };
  }

  @Post(':deviceId/cpe')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  cpe(
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Body() body: CpeCommandBody,
  ) {
    return this.mikrotik.sendCpeCommand(
      deviceId,
      body.cpeIp,
      body.command as any,
      body.params,
    );
  }
}
