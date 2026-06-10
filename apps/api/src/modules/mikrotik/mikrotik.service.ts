// ============================================================
// SIRA PLATFORM v4 - MikroTik Service (Direct API / No RADIUS)
// node-ftp → basic-ftp (modern, Promise-based, typed)
// ============================================================
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { RouterOSAPI } from 'node-routeros';
import * as ftp from 'basic-ftp';
import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE_TOKEN, DrizzleDB } from '../../database/database.module';
import { devices, vouchers, voucherBatches } from '../../database/schema';
import { SecurityService } from '../../security/security.service';
import {
  MikroTikStats,
  HotspotProfile,
  HotspotActiveUser,
  RouterInterface,
  VoucherStatus,
  MikroTikSystemInfo,
  MikroTikInterfaceDetail,
  MikroTikIpAddress,
  PppoeUser,
  PppoeActiveSession,
  CreatePppoeUserDto,
  UpdatePppoeUserDto,
  CreateHotspotProfileDto,
  UpdateHotspotProfileDto,
  GenerateProVouchersDto,
  ProVoucherRecord,
  BulkVoucherResult,
  DeviceHealth,
  BandwidthSample,
} from '@sira/shared';

@Injectable()
export class MikroTikService {
  private readonly logger = new Logger(MikroTikService.name);
  private readonly connectionPool = new Map<string, RouterOSAPI>();

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDB,
    private readonly security: SecurityService,
    private readonly config: ConfigService,
  ) {}

  // ── Connection Management ─────────────────────────────────

  private async getConnection(deviceId: string): Promise<RouterOSAPI> {
    const existing = this.connectionPool.get(deviceId);
    if (existing) {
      try {
        await (existing as any).write('/system/identity/print');
        return existing;
      } catch {
        this.connectionPool.delete(deviceId);
      }
    }

    const [device] = await this.db
      .select()
      .from(devices)
      .where(eq(devices.id, deviceId))
      .limit(1);

    if (!device) throw new NotFoundException(`الجهاز ${deviceId} غير موجود`);

    const creds = this.security.decryptCredentials(
      device.encryptedUsername,
      device.encryptedPassword,
      device.credentialIv,
      device.credentialTag,
    );

    const host = device.useVpn && device.vpnIp ? device.vpnIp : device.host;
    const api = new RouterOSAPI({
      host,
      port:      device.apiPort || 8728,
      user:      creds.username,
      password:  creds.password,
      timeout:   10,
      keepalive: true,
    });

    try {
      await api.connect();
      this.connectionPool.set(deviceId, api);
      this.logger.log(`✓ Connected to MikroTik [${device.name}] at ${host}`);
      await this.db
        .update(devices)
        .set({ status: 'online', lastSeenAt: new Date() })
        .where(eq(devices.id, deviceId));
      return api;
    } catch (err: any) {
      await this.db
        .update(devices)
        .set({ status: 'error' })
        .where(eq(devices.id, deviceId));
      throw new Error(`فشل الاتصال بالراوتر: ${err.message}`);
    }
  }

  async disconnect(deviceId: string): Promise<void> {
    const conn = this.connectionPool.get(deviceId);
    if (conn) {
      try { await conn.close(); } catch {}
      this.connectionPool.delete(deviceId);
    }
  }

  // ── System Info ───────────────────────────────────────────

  async getSystemStats(deviceId: string): Promise<MikroTikStats> {
    const api = await this.getConnection(deviceId);
    const [resources, identity, routerboard, activeUsers] = await Promise.all([
      api.write('/system/resource/print'),
      api.write('/system/identity/print'),
      api.write('/system/routerboard/print').catch(() => [{}]),
      api.write('/ip/hotspot/active/print').catch(() => []),
    ]);
    const res = resources[0] as any;
    const id  = identity[0]   as any;
    const rb  = routerboard[0] as any;

    const stats: MikroTikStats = {
      uptime:             res['uptime']        || '0s',
      cpuLoad:            parseInt(res['cpu-load']        || '0'),
      memoryUsed:         parseInt(res['total-memory']    || '0') - parseInt(res['free-memory']    || '0'),
      memoryTotal:        parseInt(res['total-memory']    || '0'),
      hddUsed:            parseInt(res['total-hdd-space'] || '0') - parseInt(res['free-hdd-space'] || '0'),
      hddTotal:           parseInt(res['total-hdd-space'] || '0'),
      activeHotspotUsers: (activeUsers as any[]).length,
      totalInterfaces:    0,
      boardName:          rb['board-name']    || id['name'] || 'Unknown',
      version:            res['version']      || 'Unknown',
      serialNumber:       rb['serial-number'] || 'N/A',
    };

    await this.db
      .update(devices)
      .set({ lastStats: stats as any, lastSeenAt: new Date(), status: 'online' })
      .where(eq(devices.id, deviceId));

    return stats;
  }

  // ── Hotspot Profiles ──────────────────────────────────────

  async getHotspotProfiles(deviceId: string): Promise<HotspotProfile[]> {
    const api      = await this.getConnection(deviceId);
    const profiles = await api.write('/ip/hotspot/user/profile/print');
    return (profiles as any[]).map((p) => ({
      name:         p['name'],
      sessionTimeout: p['session-timeout'] || '0s',
      idleTimeout:  p['idle-timeout']      || '0s',
      rateLimit:    p['rate-limit']         || '',
      sharedUsers:  parseInt(p['shared-users'] || '1'),
    }));
  }

  // ── Voucher Engine (Direct to RouterOS) ───────────────────

  async generateAndPushVouchers(params: {
    deviceId:   string;
    companyId:  string;
    batchName:  string;
    profileName: string;
    count:      number;
    prefix?:    string;
    comment?:   string;
    createdBy?: string;
  }): Promise<{ batchId: string; vouchers: string[] }> {
    const api = await this.getConnection(params.deviceId);

    const profiles = await api.write('/ip/hotspot/user/profile/print', [
      `?name=${params.profileName}`,
    ]);
    if (profiles.length === 0) {
      throw new BadRequestException(
        `بروفايل الهوتسبوت "${params.profileName}" غير موجود على الراوتر`,
      );
    }

    const codes: string[] = [];
    const prefix = params.prefix || 'SIRA';
    for (let i = 0; i < params.count; i++) {
      const random = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(`${prefix}-${random}`);
    }

    const [batch] = await this.db
      .insert(voucherBatches)
      .values({
        companyId:   params.companyId,
        deviceId:    params.deviceId,
        name:        params.batchName,
        profileName: params.profileName,
        totalCount:  params.count,
        createdBy:   params.createdBy,
      })
      .returning();

    const chunkSize = 50;
    const routerosIds: Record<string, string> = {};

    for (let i = 0; i < codes.length; i += chunkSize) {
      const chunk    = codes.slice(i, i + chunkSize);
      const promises = chunk.map(async (code) => {
        const result = await api.write('/ip/hotspot/user/add', [
          `=name=${code}`,
          `=password=${code}`,
          `=profile=${params.profileName}`,
          `=comment=${params.comment || `Batch: ${params.batchName}`}`,
        ]);
        const rosId = (result as any)['.id'];
        if (rosId) routerosIds[code] = rosId;
      });
      await Promise.all(promises);
    }

    const voucherRecords = codes.map((code) => ({
      batchId:     batch.id,
      companyId:   params.companyId,
      deviceId:    params.deviceId,
      code,
      profileName: params.profileName,
      status:      'unused' as VoucherStatus,
      comment:     params.comment,
      routerosId:  routerosIds[code],
    }));

    await this.db.insert(vouchers).values(voucherRecords);
    await this.db
      .update(voucherBatches)
      .set({ pushedToDevice: true, pushedAt: new Date() })
      .where(eq(voucherBatches.id, batch.id));

    this.logger.log(`✓ Generated and pushed ${params.count} vouchers to device ${params.deviceId}`);
    return { batchId: batch.id, vouchers: codes };
  }

  async syncVoucherStatus(deviceId: string, companyId: string): Promise<void> {
    const api         = await this.getConnection(deviceId);
    const activeUsers = await api.write('/ip/hotspot/active/print');
    const activeUserMap = new Map<string, any>();
    (activeUsers as any[]).forEach((u) => activeUserMap.set(u['user'], u));

    const allUsers  = await api.write('/ip/hotspot/user/print');
    const dbVouchers = await this.db
      .select()
      .from(vouchers)
      .where(and(eq(vouchers.deviceId, deviceId), eq(vouchers.companyId, companyId)));

    const voucherMap = new Map(dbVouchers.map((v) => [v.code, v]));

    for (const rosUser of allUsers as any[]) {
      const code      = rosUser['name'];
      const dbVoucher = voucherMap.get(code);
      if (!dbVoucher) continue;

      const isActive  = activeUserMap.has(code);
      const bytesIn   = parseInt(rosUser['bytes-in']  || '0');
      const bytesOut  = parseInt(rosUser['bytes-out'] || '0');
      const uptime    = rosUser['uptime'] || '0s';
      const disabled  = rosUser['disabled'] === 'true';

      let status: VoucherStatus = dbVoucher.status as VoucherStatus;

      if (disabled) {
        status = VoucherStatus.DISABLED;
        await this.db.update(vouchers).set({ status, updatedAt: new Date() }).where(eq(vouchers.id, dbVoucher.id));
      } else if (isActive) {
        const activeUser = activeUserMap.get(code);
        status = VoucherStatus.ACTIVE;
        await this.db.update(vouchers).set({
          status,
          usedBy:    activeUser['address'],
          usedByMac: activeUser['mac-address'],
          usedByIp:  activeUser['address'],
          usedAt:    dbVoucher.usedAt || new Date(),
          bytesIn, bytesOut, uptime,
          updatedAt: new Date(),
        }).where(eq(vouchers.id, dbVoucher.id));
      } else if (bytesIn > 0 || bytesOut > 0) {
        status = VoucherStatus.EXPIRED;
        await this.db.update(vouchers).set({ status, bytesIn, bytesOut, uptime, updatedAt: new Date() }).where(eq(vouchers.id, dbVoucher.id));
      }
    }

    await this.db.update(devices).set({ lastSyncAt: new Date() }).where(eq(devices.id, deviceId));
    this.logger.log(`✓ Voucher sync complete for device ${deviceId}`);
  }

  async getActiveHotspotUsers(deviceId: string): Promise<HotspotActiveUser[]> {
    const api    = await this.getConnection(deviceId);
    const active = await api.write('/ip/hotspot/active/print');
    return (active as any[]).map((u) => ({
      id: u['.id'], user: u['user'], address: u['address'],
      macAddress: u['mac-address'], uptime: u['uptime'],
      bytesIn: parseInt(u['bytes-in'] || '0'), bytesOut: parseInt(u['bytes-out'] || '0'),
      server: u['server'],
    }));
  }

  async kickHotspotUser(deviceId: string, activeId: string): Promise<void> {
    const api = await this.getConnection(deviceId);
    await api.write('/ip/hotspot/active/remove', [`=.id=${activeId}`]);
  }

  // ── FTP Template Upload (basic-ftp — modern, Promise-based) ──

  async uploadHotspotTemplate(
    deviceId:     string,
    zipFilePath:  string,
    templateName: string,
  ): Promise<void> {
    const [device] = await this.db
      .select()
      .from(devices)
      .where(eq(devices.id, deviceId))
      .limit(1);

    if (!device) throw new NotFoundException('الجهاز غير موجود');

    const creds = this.security.decryptCredentials(
      device.encryptedUsername,
      device.encryptedPassword,
      device.credentialIv,
      device.credentialTag,
    );

    const host = device.useVpn && device.vpnIp ? device.vpnIp : device.host;

    // Extract ZIP
    const tmpDir = path.join(os.tmpdir(), `sira-template-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const zip = new AdmZip(zipFilePath);
    zip.extractAllTo(tmpDir, true);

    const loginHtml = path.join(tmpDir, 'login.html');
    if (!fs.existsSync(loginHtml)) {
      fs.rmSync(tmpDir, { recursive: true });
      throw new BadRequestException(
        'ملف القالب غير صالح: يجب أن يحتوي على login.html في الجذر',
      );
    }

    // Upload via basic-ftp (Promise-based, no callbacks)
    const client = new ftp.Client(30000);
    client.ftp.verbose = false;

    try {
      await client.access({
        host,
        port:     21,
        user:     creds.username,
        password: creds.password,
        secure:   false,
      });

      const remotePath = `/hotspot/${templateName}`;
      await client.ensureDir(remotePath);

      const files = this.getAllFilesRecursive(tmpDir);
      for (const file of files) {
        const relativePath = path.relative(tmpDir, file).replace(/\\/g, '/');
        const remoteFile   = `${remotePath}/${relativePath}`;
        const remoteDir    = path.posix.dirname(remoteFile);

        await client.ensureDir(remoteDir);
        await client.uploadFrom(file, remoteFile);
      }

      this.logger.log(`✓ Uploaded ${files.length} files to MikroTik flash`);
    } finally {
      client.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    // Activate template via RouterOS API
    const api     = await this.getConnection(deviceId);
    const servers = await api.write('/ip/hotspot/print');
    if (servers.length > 0) {
      const serverId = (servers[0] as any)['.id'];
      await api.write('/ip/hotspot/set', [
        `=.id=${serverId}`,
        `=html-directory=hotspot/${templateName}`,
      ]);
    }

    this.logger.log(`✓ Template "${templateName}" activated on device ${deviceId}`);
  }

  // ── CPE / Access Point Control ────────────────────────────

  async sendCpeCommand(
    mikrotikDeviceId: string,
    cpeIp:            string,
    command:          'set_ssid' | 'set_password' | 'reboot' | 'get_clients' | 'get_signal',
    params?:          Record<string, string>,
  ): Promise<any> {
    const api = await this.getConnection(mikrotikDeviceId);

    switch (command) {
      case 'set_ssid': {
        const result = await api.write('/interface/wireless/set', [
          `=ssid=${params?.ssid}`,
          '=comment=managed_by_sira',
        ]);
        return { success: true, result };
      }
      case 'set_password': {
        const secProfiles = await api.write('/interface/wireless/security-profiles/print');
        if (secProfiles.length > 0) {
          const profileId = (secProfiles[0] as any)['.id'];
          await api.write('/interface/wireless/security-profiles/set', [
            `=.id=${profileId}`,
            `=wpa2-pre-shared-key=${params?.password}`,
          ]);
        }
        return { success: true };
      }
      case 'reboot':
        await api.write('/system/reboot');
        return { success: true, message: 'إعادة التشغيل قيد التنفيذ' };
      case 'get_clients':
        return api.write('/interface/wireless/registration-table/print');
      case 'get_signal':
        return api.write('/interface/wireless/registration-table/print', [
          '=.proplist=signal-strength,tx-rate,rx-rate,mac-address',
        ]);
      default:
        throw new BadRequestException(`أمر غير معروف: ${command}`);
    }
  }

  // ── Terminal ──────────────────────────────────────────────

  async executeTerminalCommand(
    deviceId: string,
    command:  string,
  ): Promise<{ output: string; error?: string }> {
    const api = await this.getConnection(deviceId);

    const BLOCKED = ['/system/reset-configuration', '/system/format-storage'];
    const norm    = command.trim().toLowerCase().replace(/\s+/g, '/');
    for (const blocked of BLOCKED) {
      if (norm.includes(blocked)) {
        return { output: '', error: '⛔ هذا الأمر محظور لأسباب أمنية' };
      }
    }

    try {
      const parts    = command.trim().split(' ');
      const cmdPath  = parts[0];
      const cmdParams = parts.slice(1).filter((p) => p.startsWith('=') || p.startsWith('?'));
      const result   = await api.write(cmdPath, cmdParams);
      return { output: JSON.stringify(result, null, 2) };
    } catch (err: any) {
      return { output: '', error: err.message };
    }
  }

  // ════════════════════════════════════════════════════════════
  // MikroTik Enterprise Module — Phases A–F
  // ════════════════════════════════════════════════════════════

  // ── Phase A: Device Information ───────────────────────────────

  /** Detailed system info: identity, version, board, arch, CPU, memory, HDD. */
  async getSystemInfo(deviceId: string): Promise<MikroTikSystemInfo> {
    const api = await this.getConnection(deviceId);
    const [resources, identity, routerboard] = await Promise.all([
      api.write('/system/resource/print'),
      api.write('/system/identity/print'),
      api.write('/system/routerboard/print').catch(() => [{}]),
    ]);
    const res = (resources[0] || {}) as any;
    const id = (identity[0] || {}) as any;
    const rb = (routerboard[0] || {}) as any;

    const totalMemory = this.toInt(res['total-memory']);
    const freeMemory = this.toInt(res['free-memory']);
    const totalHdd = this.toInt(res['total-hdd-space']);
    const freeHdd = this.toInt(res['free-hdd-space']);

    return {
      identity: id['name'] || 'Unknown',
      version: res['version'] || 'Unknown',
      boardName: res['board-name'] || rb['board-name'] || 'Unknown',
      architecture: res['architecture-name'] || 'Unknown',
      uptime: res['uptime'] || '0s',
      cpuLoad: this.toInt(res['cpu-load']),
      cpuCount: this.toInt(res['cpu-count']) || 1,
      cpuFrequency: this.toInt(res['cpu-frequency']),
      totalMemory,
      freeMemory,
      usedMemory: totalMemory - freeMemory,
      totalHdd,
      freeHdd,
      usedHdd: totalHdd - freeHdd,
      serialNumber: rb['serial-number'] || 'N/A',
      factoryFirmware: rb['factory-firmware'],
      currentFirmware: rb['current-firmware'] || rb['upgrade-firmware'],
    };
  }

  /** List all interfaces with traffic / error / drop counters. */
  async getInterfaces(deviceId: string): Promise<MikroTikInterfaceDetail[]> {
    const api = await this.getConnection(deviceId);
    const rows = await api.write('/interface/print');
    return (rows as any[]).map((i) => ({
      id: i['.id'],
      name: i['name'],
      type: i['type'] || 'unknown',
      running: i['running'] === 'true',
      disabled: i['disabled'] === 'true',
      comment: i['comment'] || undefined,
      macAddress: i['mac-address'] || undefined,
      mtu: i['mtu'] || undefined,
      rxByte: this.toInt(i['rx-byte']),
      txByte: this.toInt(i['tx-byte']),
      rxPacket: this.toInt(i['rx-packet']),
      txPacket: this.toInt(i['tx-packet']),
      rxError: this.toInt(i['rx-error']),
      txError: this.toInt(i['tx-error']),
      rxDrop: this.toInt(i['rx-drop']),
      txDrop: this.toInt(i['tx-drop']),
    }));
  }

  /** List all IPv4 addresses (/ip/address/print). */
  async getIpAddresses(deviceId: string): Promise<MikroTikIpAddress[]> {
    const api = await this.getConnection(deviceId);
    const rows = await api.write('/ip/address/print');
    return (rows as any[]).map((a) => ({
      id: a['.id'],
      address: a['address'],
      network: a['network'] || '',
      interface: a['interface'],
      disabled: a['disabled'] === 'true',
      dynamic: a['dynamic'] === 'true',
      comment: a['comment'] || undefined,
    }));
  }

  // ── Phase B: Interface Management ─────────────────────────────

  /** Resolve an interface reference (name or .id) to its RouterOS .id. */
  private async resolveInterfaceId(api: any, ref: string): Promise<string> {
    // If it already looks like a RouterOS id (e.g. "*5") use it directly.
    if (ref.startsWith('*')) return ref;
    const rows = await api.write('/interface/print', [`?name=${ref}`]);
    if (!rows || rows.length === 0) {
      throw new NotFoundException(`الواجهة "${ref}" غير موجودة على الراوتر`);
    }
    return (rows[0] as any)['.id'];
  }

  async enableInterface(deviceId: string, iface: string): Promise<{ success: true }> {
    const api = await this.getConnection(deviceId);
    const id = await this.resolveInterfaceId(api, iface);
    await api.write('/interface/enable', [`=.id=${id}`]);
    this.logger.log(`✓ Enabled interface ${iface} on device ${deviceId}`);
    return { success: true };
  }

  async disableInterface(deviceId: string, iface: string): Promise<{ success: true }> {
    const api = await this.getConnection(deviceId);
    const id = await this.resolveInterfaceId(api, iface);
    await api.write('/interface/disable', [`=.id=${id}`]);
    this.logger.log(`✓ Disabled interface ${iface} on device ${deviceId}`);
    return { success: true };
  }

  async commentInterface(
    deviceId: string,
    iface: string,
    comment: string,
  ): Promise<{ success: true }> {
    const api = await this.getConnection(deviceId);
    const id = await this.resolveInterfaceId(api, iface);
    await api.write('/interface/set', [`=.id=${id}`, `=comment=${comment}`]);
    this.logger.log(`✓ Commented interface ${iface} on device ${deviceId}`);
    return { success: true };
  }

  // ── Phase C: PPPoE Management ─────────────────────────────────

  async getPppoeUsers(deviceId: string): Promise<PppoeUser[]> {
    const api = await this.getConnection(deviceId);
    const rows = await api.write('/ppp/secret/print');
    return (rows as any[]).map((u) => ({
      id: u['.id'],
      name: u['name'],
      profile: u['profile'] || 'default',
      service: u['service'] || 'any',
      callerId: u['caller-id'] || undefined,
      rateLimit: u['rate-limit'] || undefined,
      comment: u['comment'] || undefined,
      disabled: u['disabled'] === 'true',
    }));
  }

  async createPppoeUser(dto: CreatePppoeUserDto): Promise<PppoeUser> {
    const api = await this.getConnection(dto.deviceId);

    // Reject duplicate username up-front for a clean Arabic error.
    const existing = await api.write('/ppp/secret/print', [`?name=${dto.name}`]);
    if (existing && existing.length > 0) {
      throw new BadRequestException(`مستخدم PPPoE بالاسم "${dto.name}" موجود بالفعل`);
    }

    const params = [
      `=name=${dto.name}`,
      `=password=${dto.password}`,
      `=service=${dto.service || 'pppoe'}`,
    ];
    if (dto.profile) params.push(`=profile=${dto.profile}`);
    if (dto.rateLimit) params.push(`=rate-limit=${dto.rateLimit}`);
    if (dto.comment) params.push(`=comment=${dto.comment}`);
    if (dto.disabled !== undefined) params.push(`=disabled=${dto.disabled ? 'yes' : 'no'}`);

    await api.write('/ppp/secret/add', params);
    this.logger.log(`✓ Created PPPoE user ${dto.name} on device ${dto.deviceId}`);

    const [created] = await api.write('/ppp/secret/print', [`?name=${dto.name}`]);
    const u = created as any;
    return {
      id: u['.id'],
      name: u['name'],
      profile: u['profile'] || 'default',
      service: u['service'] || 'any',
      callerId: u['caller-id'] || undefined,
      rateLimit: u['rate-limit'] || undefined,
      comment: u['comment'] || undefined,
      disabled: u['disabled'] === 'true',
    };
  }

  async updatePppoeUser(
    deviceId: string,
    secretId: string,
    dto: UpdatePppoeUserDto,
  ): Promise<{ success: true }> {
    const api = await this.getConnection(deviceId);
    const params = [`=.id=${secretId}`];
    if (dto.password !== undefined) params.push(`=password=${dto.password}`);
    if (dto.profile !== undefined) params.push(`=profile=${dto.profile}`);
    if (dto.service !== undefined) params.push(`=service=${dto.service}`);
    if (dto.rateLimit !== undefined) params.push(`=rate-limit=${dto.rateLimit}`);
    if (dto.comment !== undefined) params.push(`=comment=${dto.comment}`);
    if (dto.disabled !== undefined) params.push(`=disabled=${dto.disabled ? 'yes' : 'no'}`);

    if (params.length === 1) {
      throw new BadRequestException('لا توجد حقول للتعديل');
    }

    await api.write('/ppp/secret/set', params);
    this.logger.log(`✓ Updated PPPoE user ${secretId} on device ${deviceId}`);
    return { success: true };
  }

  async deletePppoeUser(deviceId: string, secretId: string): Promise<{ success: true }> {
    const api = await this.getConnection(deviceId);
    await api.write('/ppp/secret/remove', [`=.id=${secretId}`]);
    this.logger.log(`✓ Deleted PPPoE user ${secretId} on device ${deviceId}`);
    return { success: true };
  }

  async getActivePppoe(deviceId: string): Promise<PppoeActiveSession[]> {
    const api = await this.getConnection(deviceId);
    const rows = await api.write('/ppp/active/print');
    return (rows as any[]).map((s) => ({
      id: s['.id'],
      name: s['name'],
      service: s['service'] || 'pppoe',
      callerId: s['caller-id'] || '',
      address: s['address'] || '',
      uptime: s['uptime'] || '0s',
      encoding: s['encoding'] || undefined,
      sessionId: s['session-id'] || undefined,
    }));
  }

  /** Disconnect an active PPPoE session by its active-id. */
  async disconnectPppoe(deviceId: string, activeId: string): Promise<{ success: true }> {
    const api = await this.getConnection(deviceId);
    await api.write('/ppp/active/remove', [`=.id=${activeId}`]);
    this.logger.log(`✓ Disconnected PPPoE session ${activeId} on device ${deviceId}`);
    return { success: true };
  }

  // ── Phase D: Hotspot Profiles CRUD ────────────────────────────

  async createHotspotProfile(dto: CreateHotspotProfileDto): Promise<{ success: true; id: string }> {
    const api = await this.getConnection(dto.deviceId);

    const existing = await api.write('/ip/hotspot/user/profile/print', [`?name=${dto.name}`]);
    if (existing && existing.length > 0) {
      throw new BadRequestException(`بروفايل هوتسبوت بالاسم "${dto.name}" موجود بالفعل`);
    }

    const params = [`=name=${dto.name}`];
    if (dto.sessionTimeout) params.push(`=session-timeout=${dto.sessionTimeout}`);
    if (dto.idleTimeout) params.push(`=idle-timeout=${dto.idleTimeout}`);
    if (dto.rateLimit) params.push(`=rate-limit=${dto.rateLimit}`);
    if (dto.sharedUsers !== undefined) params.push(`=shared-users=${dto.sharedUsers}`);

    const result = await api.write('/ip/hotspot/user/profile/add', params);
    const id = (result as any)['.id'] || (result as any[])[0]?.['.id'] || '';
    this.logger.log(`✓ Created hotspot profile ${dto.name} on device ${dto.deviceId}`);
    return { success: true, id };
  }

  async updateHotspotProfile(
    deviceId: string,
    profileId: string,
    dto: UpdateHotspotProfileDto,
  ): Promise<{ success: true }> {
    const api = await this.getConnection(deviceId);
    const params = [`=.id=${profileId}`];
    if (dto.name !== undefined) params.push(`=name=${dto.name}`);
    if (dto.sessionTimeout !== undefined) params.push(`=session-timeout=${dto.sessionTimeout}`);
    if (dto.idleTimeout !== undefined) params.push(`=idle-timeout=${dto.idleTimeout}`);
    if (dto.rateLimit !== undefined) params.push(`=rate-limit=${dto.rateLimit}`);
    if (dto.sharedUsers !== undefined) params.push(`=shared-users=${dto.sharedUsers}`);

    if (params.length === 1) {
      throw new BadRequestException('لا توجد حقول للتعديل');
    }

    await api.write('/ip/hotspot/user/profile/set', params);
    this.logger.log(`✓ Updated hotspot profile ${profileId} on device ${deviceId}`);
    return { success: true };
  }

  async deleteHotspotProfile(deviceId: string, profileId: string): Promise<{ success: true }> {
    const api = await this.getConnection(deviceId);
    await api.write('/ip/hotspot/user/profile/remove', [`=.id=${profileId}`]);
    this.logger.log(`✓ Deleted hotspot profile ${profileId} on device ${deviceId}`);
    return { success: true };
  }

  // ── Phase E: Professional Voucher Generator ───────────────────

  /**
   * Generates professional vouchers with username/password, QR data, time &
   * data limits, pushes them to RouterOS hotspot, and persists to the DB.
   * Reuses existing voucher / voucher_batches tables (no new tables).
   */
  async generateProVouchers(dto: GenerateProVouchersDto): Promise<BulkVoucherResult> {
    const api = await this.getConnection(dto.deviceId);

    // Ensure the target profile exists on the router.
    const profiles = await api.write('/ip/hotspot/user/profile/print', [
      `?name=${dto.profileName}`,
    ]);
    if (!profiles || profiles.length === 0) {
      throw new BadRequestException(
        `بروفايل الهوتسبوت "${dto.profileName}" غير موجود على الراوتر`,
      );
    }

    const prefix = dto.prefix || 'SEERA';
    const usernameLen = dto.usernameLength || 6;
    const passwordLen = dto.passwordLength || 6;
    const records: ProVoucherRecord[] = [];

    for (let i = 0; i < dto.count; i++) {
      const username = dto.separateCredentials
        ? `${prefix}${this.randomCode(usernameLen)}`
        : `${prefix}-${this.randomCode(8)}`;
      const password = dto.separateCredentials
        ? this.randomCode(passwordLen)
        : username;

      records.push({
        code: username,
        username,
        password,
        // QR encodes credentials so the client can auto-fill the login page.
        qrData: `username=${username}&password=${password}`,
        profileName: dto.profileName,
        timeLimit: dto.timeLimit,
        dataLimitMb: dto.dataLimitMb,
        expiresAt: dto.expiresAt,
      });
    }

    // Persist the batch first.
    const [batch] = await this.db
      .insert(voucherBatches)
      .values({
        companyId: dto.companyId,
        deviceId: dto.deviceId,
        name: dto.batchName,
        profileName: dto.profileName,
        totalCount: dto.count,
      })
      .returning();

    // Push to RouterOS in chunks for performance.
    const chunkSize = 50;
    const routerosIds: Record<string, string> = {};
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (rec) => {
          const params = [
            `=name=${rec.username}`,
            `=password=${rec.password}`,
            `=profile=${dto.profileName}`,
            `=comment=${dto.comment || `Batch: ${dto.batchName}`}`,
          ];
          if (dto.timeLimit) params.push(`=limit-uptime=${dto.timeLimit}`);
          if (dto.dataLimitMb) {
            params.push(`=limit-bytes-total=${dto.dataLimitMb * 1024 * 1024}`);
          }
          const result = await api.write('/ip/hotspot/user/add', params);
          const rosId = (result as any)['.id'];
          if (rosId) routerosIds[rec.username] = rosId;
        }),
      );
    }

    // Persist voucher rows (reusing the existing vouchers table).
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;
    await this.db.insert(vouchers).values(
      records.map((rec) => ({
        batchId: batch.id,
        companyId: dto.companyId,
        deviceId: dto.deviceId,
        code: rec.username,
        profileName: dto.profileName,
        status: 'unused' as VoucherStatus,
        comment: dto.comment,
        routerosId: routerosIds[rec.username],
        expiresAt,
      })),
    );

    await this.db
      .update(voucherBatches)
      .set({ pushedToDevice: true, pushedAt: new Date() })
      .where(eq(voucherBatches.id, batch.id));

    this.logger.log(
      `✓ Generated ${dto.count} pro vouchers (batch "${dto.batchName}") on device ${dto.deviceId}`,
    );

    return {
      batchId: batch.id,
      batchName: dto.batchName,
      count: dto.count,
      vouchers: records,
    };
  }

  // ── Phase F: Monitoring ───────────────────────────────────────

  /** Lightweight health snapshot: online, CPU, memory, uptime, active sessions. */
  async getDeviceHealth(deviceId: string): Promise<DeviceHealth> {
    const checkedAt = new Date().toISOString();
    try {
      const api = await this.getConnection(deviceId);
      const [resources, pppoeActive, hotspotActive] = await Promise.all([
        api.write('/system/resource/print'),
        api.write('/ppp/active/print').catch(() => []),
        api.write('/ip/hotspot/active/print').catch(() => []),
      ]);
      const res = (resources[0] || {}) as any;
      const totalMemory = this.toInt(res['total-memory']);
      const freeMemory = this.toInt(res['free-memory']);
      const usedMemory = totalMemory - freeMemory;

      return {
        online: true,
        cpuLoad: this.toInt(res['cpu-load']),
        memoryUsed: usedMemory,
        memoryTotal: totalMemory,
        memoryPercent: totalMemory > 0 ? Math.round((usedMemory / totalMemory) * 100) : 0,
        uptime: res['uptime'] || '0s',
        activePppoe: (pppoeActive as any[]).length,
        activeHotspot: (hotspotActive as any[]).length,
        checkedAt,
      };
    } catch {
      // Device unreachable → report offline rather than throwing.
      return {
        online: false,
        cpuLoad: 0,
        memoryUsed: 0,
        memoryTotal: 0,
        memoryPercent: 0,
        uptime: '0s',
        activePppoe: 0,
        activeHotspot: 0,
        checkedAt,
      };
    }
  }

  /**
   * Bandwidth snapshot for an interface using /interface/monitor-traffic.
   * Defaults to the first running ethernet/bridge if no interface given.
   */
  async getBandwidth(deviceId: string, iface?: string): Promise<BandwidthSample> {
    const api = await this.getConnection(deviceId);

    let target = iface;
    if (!target) {
      const interfaces = await api.write('/interface/print');
      const running = (interfaces as any[]).find((i) => i['running'] === 'true');
      target = running ? running['name'] : (interfaces as any[])[0]?.['name'];
      if (!target) throw new NotFoundException('لا توجد واجهات على الراوتر');
    }

    const monitor = await api.write('/interface/monitor-traffic', [
      `=interface=${target}`,
      '=once=',
    ]);
    const m = ((monitor as any[])[0] || {}) as any;

    return {
      interface: target,
      rxBitsPerSecond: this.toInt(m['rx-bits-per-second']),
      txBitsPerSecond: this.toInt(m['tx-bits-per-second']),
      rxByte: this.toInt(m['rx-byte']),
      txByte: this.toInt(m['tx-byte']),
      timestamp: new Date().toISOString(),
    };
  }

  // ── Helpers ───────────────────────────────────────────────

  /** Safe integer parse for RouterOS string values (handles undefined/NaN). */
  private toInt(value: unknown): number {
    const n = parseInt(String(value ?? '0'), 10);
    return Number.isNaN(n) ? 0 : n;
  }

  /** Cryptographically-strong random alphanumeric code (no ambiguous chars). */
  private randomCode(length: number): string {
    // Exclude easily-confused characters (0/O, 1/I/L) for printed cards.
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const bytes = crypto.randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i++) {
      out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
  }

  private getAllFilesRecursive(dir: string): string[] {
    const files: string[] = [];
    for (const item of fs.readdirSync(dir)) {
      const full = path.join(dir, item);
      if (fs.statSync(full).isDirectory()) {
        files.push(...this.getAllFilesRecursive(full));
      } else {
        files.push(full);
      }
    }
    return files;
  }
}
