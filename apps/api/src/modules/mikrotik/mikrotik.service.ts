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
import { eq, and, desc } from 'drizzle-orm';
import { Interval } from '@nestjs/schedule';
import { DRIZZLE_TOKEN, DrizzleDB } from '../../database/database.module';
import { devices, vouchers, voucherBatches, auditLogs } from '../../database/schema';
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
  AuthTokenPayload,
  UserRole,
  MikroTikRealtimeSnapshot,
  MikroTikBackupType,
  MikroTikBackupRecord,
  SimpleQueue,
  CreateSimpleQueueDto,
  UpdateSimpleQueueDto,
} from '@sira/shared';

type DeviceRow = typeof devices.$inferSelect;

/** Pooled RouterOS connection plus metadata for idle eviction. */
interface PooledConnection {
  api: RouterOSAPI;
  lastUsed: number;
}

@Injectable()
export class MikroTikService {
  private readonly logger = new Logger(MikroTikService.name);
  private readonly connectionPool = new Map<string, PooledConnection>();
  /** In-flight connection promises — prevents a thundering-herd race
   *  where concurrent callers each open a separate socket for one device. */
  private readonly connecting = new Map<string, Promise<RouterOSAPI>>();

  // Connection tuning.
  private readonly CONNECT_TIMEOUT = 10;          // seconds (RouterOSAPI)
  private readonly IDLE_TTL_MS = 5 * 60 * 1000;   // evict idle sockets after 5m
  private readonly MAX_POOL_SIZE = 100;           // hard cap on open sockets
  private readonly MAX_RETRIES = 2;               // transient-failure retries

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDB,
    private readonly security: SecurityService,
    private readonly config: ConfigService,
  ) {}

  // ── Multi-Tenant Ownership ────────────────────────────────

  /**
   * Resolves a device scoped to the caller's tenant. Super-admins can reach
   * any device; everyone else is restricted to their own company. Throws
   * NotFoundException (never leaks existence) when the device is not owned.
   */
  async assertDeviceOwned(
    deviceId: string,
    user?: AuthTokenPayload,
  ): Promise<DeviceRow> {
    const scopedCompanyId =
      user && user.role !== UserRole.SUPER_ADMIN ? user.companyId : null;

    const where = scopedCompanyId
      ? and(eq(devices.id, deviceId), eq(devices.companyId, scopedCompanyId))
      : eq(devices.id, deviceId);

    const [device] = await this.db.select().from(devices).where(where).limit(1);
    if (!device) throw new NotFoundException(`الجهاز ${deviceId} غير موجود`);
    return device;
  }

  /** Returns the trusted companyId for a write that the caller may attribute. */
  resolveTenantCompanyId(device: DeviceRow, user?: AuthTokenPayload): string {
    // Always trust the device's real owner — never a client-supplied value.
    return device.companyId;
  }

  // ── Connection Management ─────────────────────────────────

  /**
   * Returns a live RouterOS connection for the device. Reuses a pooled socket
   * when healthy, otherwise (race-safely) opens a new one. When a `device`
   * row is supplied (already ownership-checked) the extra DB lookup is skipped.
   */
  private async getConnection(
    deviceId: string,
    device?: DeviceRow,
  ): Promise<RouterOSAPI> {
    const pooled = this.connectionPool.get(deviceId);
    if (pooled) {
      try {
        await pooled.api.write('/system/identity/print');
        pooled.lastUsed = Date.now();
        return pooled.api;
      } catch {
        await this.closePooled(deviceId);
      }
    }

    // Coalesce concurrent connection attempts for the same device.
    const inFlight = this.connecting.get(deviceId);
    if (inFlight) return inFlight;

    const promise = this.openConnection(deviceId, device).finally(() => {
      this.connecting.delete(deviceId);
    });
    this.connecting.set(deviceId, promise);
    return promise;
  }

  private async openConnection(
    deviceId: string,
    deviceRow?: DeviceRow,
  ): Promise<RouterOSAPI> {
    let device = deviceRow;
    if (!device) {
      const [found] = await this.db
        .select()
        .from(devices)
        .where(eq(devices.id, deviceId))
        .limit(1);
      device = found;
    }
    if (!device) throw new NotFoundException(`الجهاز ${deviceId} غير موجود`);

    const creds = this.security.decryptCredentials(
      device.encryptedUsername,
      device.encryptedPassword,
      device.credentialIv,
      device.credentialTag,
    );

    const host = device.useVpn && device.vpnIp ? device.vpnIp : device.host;

    let lastErr: any;
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      const api = new RouterOSAPI({
        host,
        port: device.apiPort || 8728,
        user: creds.username,
        password: creds.password,
        timeout: this.CONNECT_TIMEOUT,
        keepalive: true,
      });

      try {
        await api.connect();
        this.evictIfFull();
        this.connectionPool.set(deviceId, { api, lastUsed: Date.now() });
        this.logger.log(
          `✓ Connected to MikroTik [${device.name}] at ${host} (attempt ${attempt + 1})`,
        );
        await this.db
          .update(devices)
          .set({ status: 'online', lastSeenAt: new Date() })
          .where(eq(devices.id, deviceId));
        return api;
      } catch (err: any) {
        lastErr = err;
        try { await api.close(); } catch { /* ignore */ }
        if (attempt < this.MAX_RETRIES) {
          await this.sleep(300 * (attempt + 1));
        }
      }
    }

    await this.db
      .update(devices)
      .set({ status: 'error' })
      .where(eq(devices.id, deviceId));
    this.logger.warn(
      `✗ Connection failed for device ${deviceId} (${host}): ${lastErr?.message}`,
    );
    throw new Error(`فشل الاتصال بالراوتر: ${lastErr?.message || 'unknown'}`);
  }

  private async closePooled(deviceId: string): Promise<void> {
    const pooled = this.connectionPool.get(deviceId);
    if (pooled) {
      try { await pooled.api.close(); } catch { /* ignore */ }
      this.connectionPool.delete(deviceId);
    }
  }

  /** Evict the oldest connection when the pool hits its hard cap. */
  private evictIfFull(): void {
    if (this.connectionPool.size < this.MAX_POOL_SIZE) return;
    let oldestId: string | undefined;
    let oldest = Infinity;
    for (const [id, c] of this.connectionPool) {
      if (c.lastUsed < oldest) {
        oldest = c.lastUsed;
        oldestId = id;
      }
    }
    if (oldestId) void this.closePooled(oldestId);
  }

  /**
   * Periodically reap idle sockets so the pool never leaks (every 60s).
   * Must be public: @nestjs/schedule discovers @Interval handlers via
   * metadata reflection over public instance methods.
   */
  @Interval(60_000)
  reapIdleConnections(): void {
    const now = Date.now();
    for (const [id, c] of this.connectionPool) {
      if (now - c.lastUsed > this.IDLE_TTL_MS) {
        this.logger.debug(`Reaping idle MikroTik connection ${id}`);
        void this.closePooled(id);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  async disconnect(deviceId: string): Promise<void> {
    await this.closePooled(deviceId);
  }

  // ── Audit Logging ─────────────────────────────────────────

  /**
   * Records a sensitive MikroTik operation to the audit_logs table.
   * Best-effort: a logging failure must never break the actual operation.
   */
  private async audit(
    user: AuthTokenPayload | undefined,
    action: string,
    resourceId: string,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      await this.db.insert(auditLogs).values({
        companyId: user?.companyId ?? null,
        userId: user?.sub ?? null,
        action,
        resource: 'mikrotik',
        resourceId,
        details: details as any,
      });
    } catch (err: any) {
      this.logger.warn(`Audit log write failed for ${action}: ${err?.message}`);
    }
  }

  // ── System Info ───────────────────────────────────────────

  async getSystemStats(deviceId: string, user?: AuthTokenPayload): Promise<MikroTikStats> {
    const device = await this.assertDeviceOwned(deviceId, user);
    const api = await this.getConnection(deviceId, device);
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

  async getHotspotProfiles(deviceId: string, user?: AuthTokenPayload): Promise<HotspotProfile[]> {
    const device = await this.assertDeviceOwned(deviceId, user);
    const api      = await this.getConnection(deviceId, device);
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
    // Use a CSPRNG (crypto.randomBytes via randomCode) for voucher codes;
    // Math.random() is not cryptographically secure and is predictable.
    const seen = new Set<string>();
    while (codes.length < params.count) {
      const candidate = `${prefix}-${this.randomCode(8)}`;
      if (seen.has(candidate)) continue; // avoid in-batch collisions
      seen.add(candidate);
      codes.push(candidate);
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
      status:      VoucherStatus.UNUSED,
      comment:     params.comment,
      routerosId:  routerosIds[code],
    }));

    try {
      await this.db.insert(vouchers).values(voucherRecords);
    } catch (err: any) {
      // uniqueIndex on (deviceId, code) guards against duplicate voucher codes.
      // Postgres unique-violation code is 23505.
      if (err?.code === '23505') {
        throw new BadRequestException(
          'تعارض في أكواد الفاوتشر (تكرار). يرجى إعادة المحاولة.',
        );
      }
      throw err;
    }
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

  async getActiveHotspotUsers(deviceId: string, user?: AuthTokenPayload): Promise<HotspotActiveUser[]> {
    const device = await this.assertDeviceOwned(deviceId, user);
    const api    = await this.getConnection(deviceId, device);
    const active = await api.write('/ip/hotspot/active/print');
    return (active as any[]).map((u) => ({
      id: u['.id'], user: u['user'], address: u['address'],
      macAddress: u['mac-address'], uptime: u['uptime'],
      bytesIn: parseInt(u['bytes-in'] || '0'), bytesOut: parseInt(u['bytes-out'] || '0'),
      server: u['server'],
    }));
  }

  async kickHotspotUser(deviceId: string, activeId: string, user?: AuthTokenPayload): Promise<void> {
    const device = await this.assertDeviceOwned(deviceId, user);
    const api = await this.getConnection(deviceId, device);
    await api.write('/ip/hotspot/active/remove', [`=.id=${activeId}`]);
    await this.audit(user, 'mikrotik.hotspot.kick', deviceId, { activeId });
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
    user?:            AuthTokenPayload,
  ): Promise<any> {
    const device = await this.assertDeviceOwned(mikrotikDeviceId, user);
    const api = await this.getConnection(mikrotikDeviceId, device);
    await this.audit(user, 'mikrotik.cpe.command', mikrotikDeviceId, { cpeIp, command });

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
  async getSystemInfo(deviceId: string, user?: AuthTokenPayload): Promise<MikroTikSystemInfo> {
    const device = await this.assertDeviceOwned(deviceId, user);
    const api = await this.getConnection(deviceId, device);
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
  async getInterfaces(deviceId: string, user?: AuthTokenPayload): Promise<MikroTikInterfaceDetail[]> {
    const device = await this.assertDeviceOwned(deviceId, user);
    const api = await this.getConnection(deviceId, device);
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
  async getIpAddresses(deviceId: string, user?: AuthTokenPayload): Promise<MikroTikIpAddress[]> {
    const device = await this.assertDeviceOwned(deviceId, user);
    const api = await this.getConnection(deviceId, device);
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

  async enableInterface(
    deviceId: string,
    iface: string,
    user?: AuthTokenPayload,
  ): Promise<{ success: true }> {
    const device = await this.assertDeviceOwned(deviceId, user);
    const api = await this.getConnection(deviceId, device);
    const id = await this.resolveInterfaceId(api, iface);
    await api.write('/interface/enable', [`=.id=${id}`]);
    this.logger.log(`✓ Enabled interface ${iface} on device ${deviceId}`);
    await this.audit(user, 'mikrotik.interface.enable', deviceId, { iface });
    return { success: true };
  }

  async disableInterface(
    deviceId: string,
    iface: string,
    user?: AuthTokenPayload,
  ): Promise<{ success: true }> {
    const device = await this.assertDeviceOwned(deviceId, user);
    const api = await this.getConnection(deviceId, device);
    const id = await this.resolveInterfaceId(api, iface);
    await api.write('/interface/disable', [`=.id=${id}`]);
    this.logger.log(`✓ Disabled interface ${iface} on device ${deviceId}`);
    await this.audit(user, 'mikrotik.interface.disable', deviceId, { iface });
    return { success: true };
  }

  async commentInterface(
    deviceId: string,
    iface: string,
    comment: string,
    user?: AuthTokenPayload,
  ): Promise<{ success: true }> {
    const device = await this.assertDeviceOwned(deviceId, user);
    const api = await this.getConnection(deviceId, device);
    const id = await this.resolveInterfaceId(api, iface);
    await api.write('/interface/set', [`=.id=${id}`, `=comment=${comment}`]);
    this.logger.log(`✓ Commented interface ${iface} on device ${deviceId}`);
    await this.audit(user, 'mikrotik.interface.comment', deviceId, { iface, comment });
    return { success: true };
  }

  // ── Phase C: PPPoE Management ─────────────────────────────────

  async getPppoeUsers(deviceId: string, user?: AuthTokenPayload): Promise<PppoeUser[]> {
    const device = await this.assertDeviceOwned(deviceId, user);
    const api = await this.getConnection(deviceId, device);
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

  async createPppoeUser(dto: CreatePppoeUserDto, user?: AuthTokenPayload): Promise<PppoeUser> {
    const device = await this.assertDeviceOwned(dto.deviceId, user);
    const api = await this.getConnection(dto.deviceId, device);

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
    await this.audit(user, 'mikrotik.pppoe.create', dto.deviceId, { name: dto.name, profile: dto.profile });

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
    user?: AuthTokenPayload,
  ): Promise<{ success: true }> {
    const device = await this.assertDeviceOwned(deviceId, user);
    const api = await this.getConnection(deviceId, device);
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
    await this.audit(user, 'mikrotik.pppoe.update', deviceId, { secretId });
    return { success: true };
  }

  async deletePppoeUser(
    deviceId: string,
    secretId: string,
    user?: AuthTokenPayload,
  ): Promise<{ success: true }> {
    const device = await this.assertDeviceOwned(deviceId, user);
    const api = await this.getConnection(deviceId, device);
    await api.write('/ppp/secret/remove', [`=.id=${secretId}`]);
    this.logger.log(`✓ Deleted PPPoE user ${secretId} on device ${deviceId}`);
    await this.audit(user, 'mikrotik.pppoe.delete', deviceId, { secretId });
    return { success: true };
  }

  async getActivePppoe(deviceId: string, user?: AuthTokenPayload): Promise<PppoeActiveSession[]> {
    const device = await this.assertDeviceOwned(deviceId, user);
    const api = await this.getConnection(deviceId, device);
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
  async disconnectPppoe(
    deviceId: string,
    activeId: string,
    user?: AuthTokenPayload,
  ): Promise<{ success: true }> {
    const device = await this.assertDeviceOwned(deviceId, user);
    const api = await this.getConnection(deviceId, device);
    await api.write('/ppp/active/remove', [`=.id=${activeId}`]);
    this.logger.log(`✓ Disconnected PPPoE session ${activeId} on device ${deviceId}`);
    await this.audit(user, 'mikrotik.pppoe.disconnect', deviceId, { activeId });
    return { success: true };
  }

  // ── Phase D: Hotspot Profiles CRUD ────────────────────────────

  async createHotspotProfile(dto: CreateHotspotProfileDto, user?: AuthTokenPayload): Promise<{ success: true; id: string }> {
    const device = await this.assertDeviceOwned(dto.deviceId, user);
    const api = await this.getConnection(dto.deviceId, device);

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
    await this.audit(user, 'mikrotik.hotspot.profile.create', dto.deviceId, { name: dto.name });
    return { success: true, id };
  }

  async updateHotspotProfile(
    deviceId: string,
    profileId: string,
    dto: UpdateHotspotProfileDto,
    user?: AuthTokenPayload,
  ): Promise<{ success: true }> {
    const device = await this.assertDeviceOwned(deviceId, user);
    const api = await this.getConnection(deviceId, device);
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
    await this.audit(user, 'mikrotik.hotspot.profile.update', deviceId, { profileId });
    return { success: true };
  }

  async deleteHotspotProfile(
    deviceId: string,
    profileId: string,
    user?: AuthTokenPayload,
  ): Promise<{ success: true }> {
    const device = await this.assertDeviceOwned(deviceId, user);
    const api = await this.getConnection(deviceId, device);
    await api.write('/ip/hotspot/user/profile/remove', [`=.id=${profileId}`]);
    this.logger.log(`✓ Deleted hotspot profile ${profileId} on device ${deviceId}`);
    await this.audit(user, 'mikrotik.hotspot.profile.delete', deviceId, { profileId });
    return { success: true };
  }

  // ── Phase E: Professional Voucher Generator ───────────────────

  /**
   * Generates professional vouchers with username/password, QR data, time &
   * data limits, pushes them to RouterOS hotspot, and persists to the DB.
   * Reuses existing voucher / voucher_batches tables (no new tables).
   */
  async generateProVouchers(dto: GenerateProVouchersDto, user?: AuthTokenPayload): Promise<BulkVoucherResult> {
    const device = await this.assertDeviceOwned(dto.deviceId, user);
    // SECURITY: never trust the client-supplied companyId — always attribute
    // the batch to the device's real owning tenant.
    const companyId = this.resolveTenantCompanyId(device, user);
    const api = await this.getConnection(dto.deviceId, device);

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

    // Persist the batch first (attributed to the trusted tenant).
    const [batch] = await this.db
      .insert(voucherBatches)
      .values({
        companyId,
        deviceId: dto.deviceId,
        name: dto.batchName,
        profileName: dto.profileName,
        totalCount: dto.count,
        createdBy: user?.sub,
      })
      .returning();

    // Push to RouterOS in chunks for performance. Track per-voucher success so
    // a partial failure neither aborts the whole batch nor records ghost rows.
    const chunkSize = 50;
    const routerosIds: Record<string, string> = {};
    const pushed = new Set<string>();
    const failures: string[] = [];

    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const results = await Promise.allSettled(
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
          return rec.username;
        }),
      );
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') pushed.add(chunk[idx].username);
        else failures.push(chunk[idx].username);
      });
    }

    // Persist only the vouchers that were actually created on the router.
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;
    const persisted = records.filter((rec) => pushed.has(rec.username));
    if (persisted.length > 0) {
      await this.db.insert(vouchers).values(
        persisted.map((rec) => ({
          batchId: batch.id,
          companyId,
          deviceId: dto.deviceId,
          code: rec.username,
          profileName: dto.profileName,
          status: VoucherStatus.UNUSED,
          comment: dto.comment,
          routerosId: routerosIds[rec.username],
          expiresAt,
        })),
      );
    }

    await this.db
      .update(voucherBatches)
      .set({
        pushedToDevice: persisted.length > 0,
        pushedAt: new Date(),
        totalCount: persisted.length,
      })
      .where(eq(voucherBatches.id, batch.id));

    if (failures.length > 0) {
      this.logger.warn(
        `⚠ ${failures.length}/${dto.count} vouchers failed to push (batch "${dto.batchName}")`,
      );
    }
    this.logger.log(
      `✓ Generated ${persisted.length} pro vouchers (batch "${dto.batchName}") on device ${dto.deviceId}`,
    );
    await this.audit(user, 'mikrotik.voucher.generate', dto.deviceId, {
      batchId: batch.id,
      batchName: dto.batchName,
      requested: dto.count,
      created: persisted.length,
      failed: failures.length,
    });

    return {
      batchId: batch.id,
      batchName: dto.batchName,
      count: persisted.length,
      vouchers: persisted,
    };
  }

  // ── Phase F: Monitoring ───────────────────────────────────────

  /** Lightweight health snapshot: online, CPU, memory, uptime, active sessions. */
  async getDeviceHealth(deviceId: string, user?: AuthTokenPayload): Promise<DeviceHealth> {
    // Ownership is verified BEFORE the try/catch so an authorization failure
    // surfaces as 404 rather than being masked as "offline".
    const device = await this.assertDeviceOwned(deviceId, user);
    const checkedAt = new Date().toISOString();
    try {
      const api = await this.getConnection(deviceId, device);
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
  async getBandwidth(deviceId: string, iface?: string, user?: AuthTokenPayload): Promise<BandwidthSample> {
    const device = await this.assertDeviceOwned(deviceId, user);
    const api = await this.getConnection(deviceId, device);

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

  // ── Phase 4: Realtime Snapshot ────────────────────────────────

  /**
   * Combined realtime snapshot (health + bandwidth) used by both the
   * GET /devices/:id/realtime endpoint and the /ws/mikrotik broadcaster.
   * Never throws on an unreachable device — returns an offline snapshot.
   */
  async getRealtimeSnapshot(
    deviceId: string,
    user?: AuthTokenPayload,
  ): Promise<MikroTikRealtimeSnapshot> {
    const device = await this.assertDeviceOwned(deviceId, user);
    const timestamp = new Date().toISOString();
    try {
      const api = await this.getConnection(deviceId, device);
      const [resources, pppoeActive, hotspotActive, interfaces] = await Promise.all([
        api.write('/system/resource/print'),
        api.write('/ppp/active/print').catch(() => []),
        api.write('/ip/hotspot/active/print').catch(() => []),
        api.write('/interface/print').catch(() => []),
      ]);
      const res = (resources[0] || {}) as any;
      const totalMemory = this.toInt(res['total-memory']);
      const freeMemory = this.toInt(res['free-memory']);
      const usedMemory = totalMemory - freeMemory;

      // Pick the first running interface for the bandwidth sample.
      const running = (interfaces as any[]).find((i) => i['running'] === 'true');
      const target = running ? running['name'] : (interfaces as any[])[0]?.['name'];

      let rxBits = 0;
      let txBits = 0;
      if (target) {
        try {
          const monitor = await api.write('/interface/monitor-traffic', [
            `=interface=${target}`,
            '=once=',
          ]);
          const m = ((monitor as any[])[0] || {}) as any;
          rxBits = this.toInt(m['rx-bits-per-second']);
          txBits = this.toInt(m['tx-bits-per-second']);
        } catch { /* bandwidth optional */ }
      }

      return {
        deviceId,
        online: true,
        cpuLoad: this.toInt(res['cpu-load']),
        memoryUsed: usedMemory,
        memoryTotal: totalMemory,
        memoryPercent: totalMemory > 0 ? Math.round((usedMemory / totalMemory) * 100) : 0,
        uptime: res['uptime'] || '0s',
        activePppoe: (pppoeActive as any[]).length,
        activeHotspot: (hotspotActive as any[]).length,
        rxBitsPerSecond: rxBits,
        txBitsPerSecond: txBits,
        interface: target || '',
        timestamp,
      };
    } catch {
      return {
        deviceId,
        online: false,
        cpuLoad: 0,
        memoryUsed: 0,
        memoryTotal: 0,
        memoryPercent: 0,
        uptime: '0s',
        activePppoe: 0,
        activeHotspot: 0,
        rxBitsPerSecond: 0,
        txBitsPerSecond: 0,
        interface: '',
        timestamp,
      };
    }
  }

  /**
   * Returns the company ids that have at least one active MikroTik device,
   * used by the realtime broadcaster to know which tenant rooms to feed.
   */
  async getActiveMikrotikDeviceIds(): Promise<Array<{ id: string; companyId: string }>> {
    const rows = await this.db
      .select({ id: devices.id, companyId: devices.companyId, type: devices.type, isActive: devices.isActive })
      .from(devices)
      .where(and(eq(devices.type, 'mikrotik' as any), eq(devices.isActive, true)));
    return rows.map((r) => ({ id: r.id, companyId: r.companyId }));
  }

  // ── Phase 5: Backup Management ────────────────────────────────

  private backupDir(deviceId: string): string {
    // Reuse the container's existing /app/uploads mount (created in Dockerfile).
    const base = this.config.get<string>('UPLOADS_DIR') || path.resolve(process.cwd(), 'uploads');
    return path.join(base, 'mikrotik-backups', deviceId);
  }

  /**
   * Creates a backup on the router, downloads it via FTP, stores it locally
   * under uploads/mikrotik-backups/<deviceId>/ and returns a download record.
   *  - 'binary' → /system/backup save  → .backup file
   *  - 'export' → /export              → .rsc text file
   */
  async createBackup(
    deviceId: string,
    type: MikroTikBackupType,
    user?: AuthTokenPayload,
  ): Promise<MikroTikBackupRecord> {
    const device = await this.assertDeviceOwned(deviceId, user);
    const api = await this.getConnection(deviceId, device);

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const remoteBase = `seera-backup-${stamp}`;
    const ext = type === 'binary' ? 'backup' : 'rsc';
    const remoteFile = `${remoteBase}.${ext}`;

    if (type === 'binary') {
      await api.write('/system/backup/save', [`=name=${remoteBase}`]);
    } else {
      await api.write('/export', [`=file=${remoteBase}`]);
    }

    // The router writes the file asynchronously; give it a brief moment.
    await this.sleep(1500);

    const dir = this.backupDir(deviceId);
    fs.mkdirSync(dir, { recursive: true });
    const localPath = path.join(dir, remoteFile);

    const creds = this.security.decryptCredentials(
      device.encryptedUsername,
      device.encryptedPassword,
      device.credentialIv,
      device.credentialTag,
    );
    const host = device.useVpn && device.vpnIp ? device.vpnIp : device.host;

    const client = new ftp.Client(30000);
    client.ftp.verbose = false;
    try {
      await client.access({ host, port: 21, user: creds.username, password: creds.password, secure: false });
      await client.downloadTo(localPath, remoteFile);
    } finally {
      client.close();
    }

    const size = fs.existsSync(localPath) ? fs.statSync(localPath).size : 0;
    this.logger.log(`✓ Backup (${type}) created for device ${deviceId}: ${remoteFile} (${size} bytes)`);
    await this.audit(user, 'mikrotik.backup.create', deviceId, { type, fileName: remoteFile, size });

    return {
      fileName: remoteFile,
      type,
      sizeBytes: size,
      createdAt: new Date().toISOString(),
      downloadUrl: `/api/v1/mikrotik/devices/${deviceId}/backups/${encodeURIComponent(remoteFile)}`,
    };
  }

  /** Lists previously downloaded backups for a device. */
  async listBackups(deviceId: string, user?: AuthTokenPayload): Promise<MikroTikBackupRecord[]> {
    await this.assertDeviceOwned(deviceId, user);
    const dir = this.backupDir(deviceId);
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.backup') || f.endsWith('.rsc'))
      .map((f) => {
        const stat = fs.statSync(path.join(dir, f));
        return {
          fileName: f,
          type: (f.endsWith('.backup') ? 'binary' : 'export') as MikroTikBackupType,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString(),
          downloadUrl: `/api/v1/mikrotik/devices/${deviceId}/backups/${encodeURIComponent(f)}`,
        };
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  /** Resolves the absolute path of a stored backup, with ownership + path-safety checks. */
  async resolveBackupPath(deviceId: string, fileName: string, user?: AuthTokenPayload): Promise<string> {
    await this.assertDeviceOwned(deviceId, user);
    // Prevent path traversal — only a bare filename is allowed.
    const safe = path.basename(fileName);
    if (safe !== fileName) throw new BadRequestException('اسم ملف غير صالح');
    const full = path.join(this.backupDir(deviceId), safe);
    if (!fs.existsSync(full)) throw new NotFoundException('ملف النسخة الاحتياطية غير موجود');
    return full;
  }

  // ── Phase 6: Queue Management (Simple Queues) ─────────────────

  async getQueues(deviceId: string, user?: AuthTokenPayload): Promise<SimpleQueue[]> {
    const device = await this.assertDeviceOwned(deviceId, user);
    const api = await this.getConnection(deviceId, device);
    const rows = await api.write('/queue/simple/print');
    return (rows as any[]).map((q) => ({
      id: q['.id'],
      name: q['name'],
      target: q['target'] || '',
      maxLimit: q['max-limit'] || undefined,
      burstLimit: q['burst-limit'] || undefined,
      burstThreshold: q['burst-threshold'] || undefined,
      burstTime: q['burst-time'] || undefined,
      comment: q['comment'] || undefined,
      disabled: q['disabled'] === 'true',
    }));
  }

  async createQueue(dto: CreateSimpleQueueDto, user?: AuthTokenPayload): Promise<{ success: true; id: string }> {
    const device = await this.assertDeviceOwned(dto.deviceId, user);
    const api = await this.getConnection(dto.deviceId, device);

    const params = [`=name=${dto.name}`, `=target=${dto.target}`];
    if (dto.maxLimit) params.push(`=max-limit=${dto.maxLimit}`);
    if (dto.burstLimit) params.push(`=burst-limit=${dto.burstLimit}`);
    if (dto.burstThreshold) params.push(`=burst-threshold=${dto.burstThreshold}`);
    if (dto.burstTime) params.push(`=burst-time=${dto.burstTime}`);
    if (dto.comment) params.push(`=comment=${dto.comment}`);
    if (dto.disabled !== undefined) params.push(`=disabled=${dto.disabled ? 'yes' : 'no'}`);

    const result = await api.write('/queue/simple/add', params);
    const id = (result as any)['.id'] || (result as any[])[0]?.['.id'] || '';
    this.logger.log(`✓ Created simple queue ${dto.name} on device ${dto.deviceId}`);
    await this.audit(user, 'mikrotik.queue.create', dto.deviceId, { name: dto.name, target: dto.target });
    return { success: true, id };
  }

  async updateQueue(
    deviceId: string,
    queueId: string,
    dto: UpdateSimpleQueueDto,
    user?: AuthTokenPayload,
  ): Promise<{ success: true }> {
    const device = await this.assertDeviceOwned(deviceId, user);
    const api = await this.getConnection(deviceId, device);
    const params = [`=.id=${queueId}`];
    if (dto.name !== undefined) params.push(`=name=${dto.name}`);
    if (dto.target !== undefined) params.push(`=target=${dto.target}`);
    if (dto.maxLimit !== undefined) params.push(`=max-limit=${dto.maxLimit}`);
    if (dto.burstLimit !== undefined) params.push(`=burst-limit=${dto.burstLimit}`);
    if (dto.burstThreshold !== undefined) params.push(`=burst-threshold=${dto.burstThreshold}`);
    if (dto.burstTime !== undefined) params.push(`=burst-time=${dto.burstTime}`);
    if (dto.comment !== undefined) params.push(`=comment=${dto.comment}`);
    if (dto.disabled !== undefined) params.push(`=disabled=${dto.disabled ? 'yes' : 'no'}`);

    if (params.length === 1) throw new BadRequestException('لا توجد حقول للتعديل');

    await api.write('/queue/simple/set', params);
    this.logger.log(`✓ Updated simple queue ${queueId} on device ${deviceId}`);
    await this.audit(user, 'mikrotik.queue.update', deviceId, { queueId });
    return { success: true };
  }

  async deleteQueue(deviceId: string, queueId: string, user?: AuthTokenPayload): Promise<{ success: true }> {
    const device = await this.assertDeviceOwned(deviceId, user);
    const api = await this.getConnection(deviceId, device);
    await api.write('/queue/simple/remove', [`=.id=${queueId}`]);
    this.logger.log(`✓ Deleted simple queue ${queueId} on device ${deviceId}`);
    await this.audit(user, 'mikrotik.queue.delete', deviceId, { queueId });
    return { success: true };
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
