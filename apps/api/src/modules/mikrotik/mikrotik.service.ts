// ============================================================
// SIRA PLATFORM v4 - MikroTik Service (Direct API / No RADIUS)
// node-ftp → basic-ftp (modern, Promise-based, typed)
// ============================================================
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { RouterOSAPI } from 'node-routeros';
import * as ftp from 'basic-ftp';
import * as AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
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

  // ── Helpers ───────────────────────────────────────────────

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
