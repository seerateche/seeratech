// ============================================================
// SEERA PLATFORM v4 - MikroTik Controller
// Global prefix `api/v1` → all routes are /api/v1/mikrotik/...
// Every handler threads the authenticated user (@CurrentUser) into the
// service so tenant-ownership is enforced for ALL device operations.
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
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import { basename } from 'path';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { MikroTikService } from './mikrotik.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/auth.service';
import { CurrentUser } from '../../common/current-user.decorator';
import { AuthTokenPayload, UserRole, MikroTikBackupType } from '@sira/shared';
import {
  InterfaceActionBody,
  InterfaceCommentBody,
  CreatePppoeUserBody,
  UpdatePppoeUserBody,
  DisconnectPppoeBody,
  CreateHotspotProfileBody,
  UpdateHotspotProfileBody,
  GenerateProVouchersBody,
  CreateBackupBody,
  CreateSimpleQueueBody,
  UpdateSimpleQueueBody,
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
  // segments (interfaces / pppoe / hotspot / queues) before the param route.
  // ============================================================

  // ── Phase B: Interface Management ───────────────────────────

  @Post('interfaces/enable')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'تفعيل واجهة شبكة (enable interface)' })
  enableInterface(@CurrentUser() user: AuthTokenPayload, @Body() body: InterfaceActionBody) {
    return this.mikrotik.enableInterface(body.deviceId, body.interface, user);
  }

  @Post('interfaces/disable')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'تعطيل واجهة شبكة (disable interface)' })
  disableInterface(@CurrentUser() user: AuthTokenPayload, @Body() body: InterfaceActionBody) {
    return this.mikrotik.disableInterface(body.deviceId, body.interface, user);
  }

  @Post('interfaces/comment')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'إضافة تعليق لواجهة شبكة (comment interface)' })
  commentInterface(@CurrentUser() user: AuthTokenPayload, @Body() body: InterfaceCommentBody) {
    return this.mikrotik.commentInterface(body.deviceId, body.interface, body.comment, user);
  }

  // ── Phase C: PPPoE Management ───────────────────────────────

  @Get('pppoe/users')
  @ApiOperation({ summary: 'قائمة مستخدمي PPPoE (secrets)' })
  pppoeUsers(
    @CurrentUser() user: AuthTokenPayload,
    @Query('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    return this.mikrotik.getPppoeUsers(deviceId, user);
  }

  @Post('pppoe/users')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'إنشاء مستخدم PPPoE جديد' })
  createPppoeUser(@CurrentUser() user: AuthTokenPayload, @Body() body: CreatePppoeUserBody) {
    return this.mikrotik.createPppoeUser(body, user);
  }

  @Patch('pppoe/users/:id')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'تعديل مستخدم PPPoE' })
  updatePppoeUser(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Body() body: UpdatePppoeUserBody,
  ) {
    return this.mikrotik.updatePppoeUser(body.deviceId, id, body, user);
  }

  @Delete('pppoe/users/:id')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'حذف مستخدم PPPoE' })
  deletePppoeUser(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Query('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    return this.mikrotik.deletePppoeUser(deviceId, id, user);
  }

  @Get('pppoe/active')
  @ApiOperation({ summary: 'جلسات PPPoE النشطة' })
  activePppoe(
    @CurrentUser() user: AuthTokenPayload,
    @Query('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    return this.mikrotik.getActivePppoe(deviceId, user);
  }

  @Post('pppoe/disconnect')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'قطع جلسة PPPoE نشطة' })
  disconnectPppoe(@CurrentUser() user: AuthTokenPayload, @Body() body: DisconnectPppoeBody) {
    return this.mikrotik.disconnectPppoe(body.deviceId, body.activeId, user);
  }

  // ── Phase D: Hotspot Profiles CRUD ──────────────────────────

  @Get('hotspot/profiles')
  @ApiOperation({ summary: 'قائمة بروفايلات الهوتسبوت' })
  hotspotProfiles(
    @CurrentUser() user: AuthTokenPayload,
    @Query('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    return this.mikrotik.getHotspotProfiles(deviceId, user);
  }

  @Post('hotspot/profiles')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'إنشاء بروفايل هوتسبوت' })
  createHotspotProfile(@CurrentUser() user: AuthTokenPayload, @Body() body: CreateHotspotProfileBody) {
    return this.mikrotik.createHotspotProfile(body, user);
  }

  @Patch('hotspot/profiles/:id')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'تعديل بروفايل هوتسبوت' })
  updateHotspotProfile(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Body() body: UpdateHotspotProfileBody,
  ) {
    return this.mikrotik.updateHotspotProfile(body.deviceId, id, body, user);
  }

  @Delete('hotspot/profiles/:id')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'حذف بروفايل هوتسبوت' })
  deleteHotspotProfile(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Query('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    return this.mikrotik.deleteHotspotProfile(deviceId, id, user);
  }

  // ── Phase E: Professional Voucher Generator ─────────────────

  @Post('vouchers/generate')
  @Roles(...WRITE_ROLES)
  @ApiOperation({
    summary: 'مولّد كروت احترافي (Bulk: 10/50/100/500) مع QR وحدود الوقت/البيانات',
  })
  generateProVouchers(@CurrentUser() user: AuthTokenPayload, @Body() body: GenerateProVouchersBody) {
    return this.mikrotik.generateProVouchers(body, user);
  }

  // ── Phase 6: Queue Management (Simple Queues) ───────────────

  @Get('queues')
  @ApiOperation({ summary: 'قائمة Simple Queues (Rate/Max Limit/Burst)' })
  getQueues(
    @CurrentUser() user: AuthTokenPayload,
    @Query('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    return this.mikrotik.getQueues(deviceId, user);
  }

  @Post('queues')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'إنشاء Simple Queue' })
  createQueue(@CurrentUser() user: AuthTokenPayload, @Body() body: CreateSimpleQueueBody) {
    return this.mikrotik.createQueue(body, user);
  }

  @Patch('queues/:id')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'تعديل Simple Queue' })
  updateQueue(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Body() body: UpdateSimpleQueueBody,
  ) {
    return this.mikrotik.updateQueue(body.deviceId, id, body, user);
  }

  @Delete('queues/:id')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'حذف Simple Queue' })
  deleteQueue(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Query('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    return this.mikrotik.deleteQueue(deviceId, id, user);
  }

  // ============================================================
  // DEVICE-SCOPED ROUTES (`devices/:id/...`)
  // ============================================================

  // ── Phase A: Device Information ─────────────────────────────

  @Get('devices/:id/system')
  @ApiOperation({ summary: 'معلومات النظام (Identity/Version/CPU/Memory/HDD/Uptime)' })
  systemInfo(@CurrentUser() user: AuthTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.mikrotik.getSystemInfo(id, user);
  }

  @Get('devices/:id/interfaces')
  @ApiOperation({ summary: 'قائمة الواجهات مع RX/TX والحالة' })
  deviceInterfaces(@CurrentUser() user: AuthTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.mikrotik.getInterfaces(id, user);
  }

  @Get('devices/:id/ip-addresses')
  @ApiOperation({ summary: 'عناوين IP (Address/Network/Interface)' })
  deviceIpAddresses(@CurrentUser() user: AuthTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.mikrotik.getIpAddresses(id, user);
  }

  // ── Phase F / Phase 4: Monitoring ───────────────────────────

  @Get('devices/:id/health')
  @ApiOperation({
    summary: 'صحة الجهاز (Online/CPU/Memory/Uptime/Active PPPoE/Active Hotspot)',
  })
  deviceHealth(@CurrentUser() user: AuthTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.mikrotik.getDeviceHealth(id, user);
  }

  @Get('devices/:id/bandwidth')
  @ApiOperation({ summary: 'عرض النطاق اللحظي (RX/TX/Timestamp)' })
  deviceBandwidth(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('interface') iface?: string,
  ) {
    return this.mikrotik.getBandwidth(id, iface, user);
  }

  @Get('devices/:id/realtime')
  @ApiOperation({
    summary: 'لقطة لحظية مجمّعة (CPU/Memory/Uptime/PPPoE/Hotspot/RX/TX) — نفس بيانات /ws/mikrotik',
  })
  deviceRealtime(@CurrentUser() user: AuthTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.mikrotik.getRealtimeSnapshot(id, user);
  }

  // ── Phase 5: Backup Management ──────────────────────────────

  @Post('devices/:id/backup')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'إنشاء نسخة احتياطية (Binary أو Export) وإرجاع رابط التحميل' })
  createBackup(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateBackupBody,
  ) {
    const type: MikroTikBackupType = body.type === 'export' ? 'export' : 'binary';
    return this.mikrotik.createBackup(id, type, user);
  }

  @Get('devices/:id/backups')
  @ApiOperation({ summary: 'قائمة النسخ الاحتياطية السابقة' })
  listBackups(@CurrentUser() user: AuthTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.mikrotik.listBackups(id, user);
  }

  @Get('devices/:id/backups/:fileName')
  @ApiOperation({ summary: 'تحميل ملف نسخة احتياطية' })
  async downloadBackup(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileName') fileName: string,
  ): Promise<StreamableFile> {
    const full = await this.mikrotik.resolveBackupPath(id, fileName, user);
    return new StreamableFile(createReadStream(full), {
      disposition: `attachment; filename="${basename(full)}"`,
    });
  }

  // ============================================================
  // EXISTING ROUTES (unchanged paths — now tenant-scoped)
  // ============================================================

  @Get(':deviceId/stats')
  stats(@CurrentUser() user: AuthTokenPayload, @Param('deviceId', ParseUUIDPipe) deviceId: string) {
    return this.mikrotik.getSystemStats(deviceId, user);
  }

  @Get(':deviceId/hotspot/profiles')
  profiles(@CurrentUser() user: AuthTokenPayload, @Param('deviceId', ParseUUIDPipe) deviceId: string) {
    return this.mikrotik.getHotspotProfiles(deviceId, user);
  }

  @Get(':deviceId/hotspot/active')
  activeUsers(@CurrentUser() user: AuthTokenPayload, @Param('deviceId', ParseUUIDPipe) deviceId: string) {
    return this.mikrotik.getActiveHotspotUsers(deviceId, user);
  }

  @Post(':deviceId/hotspot/kick/:activeId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  async kick(
    @CurrentUser() user: AuthTokenPayload,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Param('activeId') activeId: string,
  ) {
    await this.mikrotik.kickHotspotUser(deviceId, activeId, user);
    return { kicked: true };
  }

  @Post(':deviceId/cpe')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  cpe(
    @CurrentUser() user: AuthTokenPayload,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Body() body: CpeCommandBody,
  ) {
    return this.mikrotik.sendCpeCommand(
      deviceId,
      body.cpeIp,
      body.command as any,
      body.params,
      user,
    );
  }
}
