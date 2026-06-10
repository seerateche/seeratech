// ============================================================
// SEERA PLATFORM v4 - MikroTik Controller
// Global prefix `api/v1` → all routes are /api/v1/mikrotik/...
// ============================================================
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { MikroTikService } from './mikrotik.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/auth.service';
import { UserRole } from '@sira/shared';
import {
  InterfaceActionBody,
  InterfaceCommentBody,
  CreatePppoeUserBody,
  UpdatePppoeUserBody,
  DisconnectPppoeBody,
  CreateHotspotProfileBody,
  UpdateHotspotProfileBody,
  GenerateProVouchersBody,
} from './dto/mikrotik-enterprise.dto';

export class CpeCommandBody {
  @IsString() cpeIp: string;
  @IsString() command: string;
  @IsOptional() @IsObject() params?: Record<string, string>;
}

// Roles allowed to perform write/management actions.
const WRITE_ROLES = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN] as const;

@ApiTags('mikrotik')
@ApiBearerAuth()
@Controller('mikrotik')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MikroTikController {
  constructor(private readonly mikrotik: MikroTikService) {}

  // ============================================================
  // STATIC-PREFIX ROUTES FIRST
  // Declared before `:deviceId/...` so Nest matches the literal
  // segments (interfaces / pppoe / hotspot) before the param route.
  // ============================================================

  // ── Phase B: Interface Management ───────────────────────────

  @Post('interfaces/enable')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'تفعيل واجهة شبكة (enable interface)' })
  enableInterface(@Body() body: InterfaceActionBody) {
    return this.mikrotik.enableInterface(body.deviceId, body.interface);
  }

  @Post('interfaces/disable')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'تعطيل واجهة شبكة (disable interface)' })
  disableInterface(@Body() body: InterfaceActionBody) {
    return this.mikrotik.disableInterface(body.deviceId, body.interface);
  }

  @Post('interfaces/comment')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'إضافة تعليق لواجهة شبكة (comment interface)' })
  commentInterface(@Body() body: InterfaceCommentBody) {
    return this.mikrotik.commentInterface(
      body.deviceId,
      body.interface,
      body.comment,
    );
  }

  // ── Phase C: PPPoE Management ───────────────────────────────

  @Get('pppoe/users')
  @ApiOperation({ summary: 'قائمة مستخدمي PPPoE (secrets)' })
  pppoeUsers(@Query('deviceId', ParseUUIDPipe) deviceId: string) {
    return this.mikrotik.getPppoeUsers(deviceId);
  }

  @Post('pppoe/users')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'إنشاء مستخدم PPPoE جديد' })
  createPppoeUser(@Body() body: CreatePppoeUserBody) {
    return this.mikrotik.createPppoeUser(body);
  }

  @Patch('pppoe/users/:id')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'تعديل مستخدم PPPoE' })
  updatePppoeUser(
    @Param('id') id: string,
    @Body() body: UpdatePppoeUserBody,
  ) {
    return this.mikrotik.updatePppoeUser(body.deviceId, id, body);
  }

  @Delete('pppoe/users/:id')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'حذف مستخدم PPPoE' })
  deletePppoeUser(
    @Param('id') id: string,
    @Query('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    return this.mikrotik.deletePppoeUser(deviceId, id);
  }

  @Get('pppoe/active')
  @ApiOperation({ summary: 'جلسات PPPoE النشطة' })
  activePppoe(@Query('deviceId', ParseUUIDPipe) deviceId: string) {
    return this.mikrotik.getActivePppoe(deviceId);
  }

  @Post('pppoe/disconnect')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'قطع جلسة PPPoE نشطة' })
  disconnectPppoe(@Body() body: DisconnectPppoeBody) {
    return this.mikrotik.disconnectPppoe(body.deviceId, body.activeId);
  }

  // ── Phase D: Hotspot Profiles CRUD ──────────────────────────

  @Get('hotspot/profiles')
  @ApiOperation({ summary: 'قائمة بروفايلات الهوتسبوت' })
  hotspotProfiles(@Query('deviceId', ParseUUIDPipe) deviceId: string) {
    return this.mikrotik.getHotspotProfiles(deviceId);
  }

  @Post('hotspot/profiles')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'إنشاء بروفايل هوتسبوت' })
  createHotspotProfile(@Body() body: CreateHotspotProfileBody) {
    return this.mikrotik.createHotspotProfile(body);
  }

  @Patch('hotspot/profiles/:id')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'تعديل بروفايل هوتسبوت' })
  updateHotspotProfile(
    @Param('id') id: string,
    @Body() body: UpdateHotspotProfileBody,
  ) {
    return this.mikrotik.updateHotspotProfile(body.deviceId, id, body);
  }

  @Delete('hotspot/profiles/:id')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'حذف بروفايل هوتسبوت' })
  deleteHotspotProfile(
    @Param('id') id: string,
    @Query('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    return this.mikrotik.deleteHotspotProfile(deviceId, id);
  }

  // ── Phase E: Professional Voucher Generator ─────────────────

  @Post('vouchers/generate')
  @Roles(...WRITE_ROLES)
  @ApiOperation({
    summary: 'مولّد كروت احترافي (Bulk: 10/50/100/500) مع QR وحدود الوقت/البيانات',
  })
  generateProVouchers(@Body() body: GenerateProVouchersBody) {
    return this.mikrotik.generateProVouchers(body);
  }

  // ============================================================
  // DEVICE-SCOPED ROUTES (`:deviceId/...`)
  // ============================================================

  // ── Phase A: Device Information ─────────────────────────────

  @Get('devices/:id/system')
  @ApiOperation({ summary: 'معلومات النظام (Identity/Version/CPU/Memory/HDD/Uptime)' })
  systemInfo(@Param('id', ParseUUIDPipe) id: string) {
    return this.mikrotik.getSystemInfo(id);
  }

  @Get('devices/:id/interfaces')
  @ApiOperation({ summary: 'قائمة الواجهات مع RX/TX والحالة' })
  deviceInterfaces(@Param('id', ParseUUIDPipe) id: string) {
    return this.mikrotik.getInterfaces(id);
  }

  @Get('devices/:id/ip-addresses')
  @ApiOperation({ summary: 'عناوين IP (Address/Network/Interface)' })
  deviceIpAddresses(@Param('id', ParseUUIDPipe) id: string) {
    return this.mikrotik.getIpAddresses(id);
  }

  // ── Phase F: Monitoring ─────────────────────────────────────

  @Get('devices/:id/health')
  @ApiOperation({
    summary: 'صحة الجهاز (Online/CPU/Memory/Uptime/Active PPPoE/Active Hotspot)',
  })
  deviceHealth(@Param('id', ParseUUIDPipe) id: string) {
    return this.mikrotik.getDeviceHealth(id);
  }

  @Get('devices/:id/bandwidth')
  @ApiOperation({ summary: 'عرض النطاق اللحظي (RX/TX/Timestamp)' })
  deviceBandwidth(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('interface') iface?: string,
  ) {
    return this.mikrotik.getBandwidth(id, iface);
  }

  // ============================================================
  // EXISTING ROUTES (unchanged — backward compatible)
  // ============================================================

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
