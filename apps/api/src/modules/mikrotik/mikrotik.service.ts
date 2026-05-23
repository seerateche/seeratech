// ============================================================
// SIRA PLATFORM v4 - MikroTik Service (Direct API / No RADIUS)
// ============================================================
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { RouterOSAPI } from 'node-routeros';
import * as FTP from 'node-ftp';
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

export interface RouterOSConnection {
  api: RouterOSAPI;
  deviceId: string;
}

@Injectable()
export class MikroTikService {
  private readonly logger = new Logger(MikroTikService.name);
  // Active connection pool
  private readonly connectionPool = new Map<string, RouterOSAPI>();

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDB,
    private readonly security: SecurityService,
    private readonly config: ConfigService,
  ) {}

  // ── Connection Management ─────────────────────────────────

  private async getConnection(deviceId: string): Promise<RouterOSAPI> {
    // Return pooled connection if alive
    const existing = this.connectionPool.get(deviceId);
    if (existing) {
      try {
        // Ping test
        await (existing as any).write('/system/identity/print');
        return existing;
      } catch {
        this.connectionPool.delete(deviceId);
      }
    }

    // Load device from DB
    const [device] = await this.db
      .select()
      .from(devices)
      .where(eq(devices.id, deviceId))
      .limit(1);

    if (!device) throw new NotFoundException(`الجهاز ${deviceId} غير موجود`);

    // Decrypt credentials in-memory
    const creds = this.security.decryptCredentials(
      device.encryptedUsername,
      device.encryptedPassword,
      device.credentialIv,
      device.credentialTag,
    );

    const host = device.useVpn && device.vpnIp ? device.vpnIp : device.host;
    const api = new RouterOSAPI({
      host,
      port: device.apiPort || 8728,
      user: creds.username,
      password: creds.password,
      timeout: 10,
      keepalive: true,
    });

    try {
      await api.connect();
      this.connectionPool.set(deviceId, api);
      this.logger.log(`✓ Connected to MikroTik [${device.name}] at ${host}`);

      // Update device status
      await this.db
        .update(devices)
        .set({ status: 'online', lastSeenAt: new Date() })
        .where(eq(devices.id, deviceId));

      return api;
    } catch (err) {
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
      try {
        await conn.close();
      } catch {}
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
    const id = identity[0] as any;
    const rb = routerboard[0] as any;

    // Save stats snapshot
    const stats: MikroTikStats = {
      uptime: res['uptime'] || '0s',
      cpuLoad: parseInt(res['cpu-load'] || '0'),
      memoryUsed: parseInt(res['total-memory'] || '0') - parseInt(res['free-memory'] || '0'),
      memoryTotal: parseInt(res['total-memory'] || '0'),
      hddUsed: parseInt(res['total-hdd-space'] || '0') - parseInt(res['free-hdd-space'] || '0'),
      hddTotal: parseInt(res['total-hdd-space'] || '0'),
      activeHotspotUsers: activeUsers.length,
      totalInterfaces: 0,
      boardName: rb['board-name'] || id['name'] || 'Unknown',
      version: res['version'] || 'Unknown',
      serialNumber: rb['serial-number'] || 'N/A',
    };

    await this.db
      .update(devices)
      .set({ lastStats: stats as any, lastSeenAt: new Date(), status: 'online' })
      .where(eq(devices.id, deviceId));

    return stats;
  }

  // ── Hotspot Profiles ──────────────────────────────────────

  async getHotspotProfiles(deviceId: string): Promise<HotspotProfile[]> {
    const api = await this.getConnection(deviceId);
    const profiles = await api.write('/ip/hotspot/user/profile/print');

    return (profiles as any[]).map((p) => ({
      name: p['name'],
      sessionTimeout: p['session-timeout'] || '0s',
      idleTimeout: p['idle-timeout'] || '0s',
      rateLimit: p['rate-limit'] || '',
      sharedUsers: parseInt(p['shared-users'] || '1'),
    }));
  }

  // ── Voucher Engine (Direct to RouterOS, No RADIUS) ────────

  async generateAndPushVouchers(params: {
    deviceId: string;
    companyId: string;
    batchName: string;
    profileName: string;
    count: number;
    prefix?: string;
    comment?: string;
    createdBy?: string;
  }): Promise<{ batchId: string; vouchers: string[] }> {
    const api = await this.getConnection(params.deviceId);

    // Verify profile exists on the router
    const profiles = await api.write('/ip/hotspot/user/profile/print', [
      `?name=${params.profileName}`,
    ]);
    if (profiles.length === 0) {
      throw new BadRequestException(
        `بروفايل الهوتسبوت "${params.profileName}" غير موجود على الراوتر`,
      );
    }

    // Generate voucher codes
    const codes: string[] = [];
    const prefix = params.prefix || 'SIRA';
    for (let i = 0; i < params.count; i++) {
      // Format: PREFIX-XXXXXXXX (8 random alphanumeric)
      const random = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(`${prefix}-${random}`);
    }

    // Create batch record
    const [batch] = await this.db
      .insert(voucherBatches)
      .values({
        companyId: params.companyId,
        deviceId: params.deviceId,
        name: params.batchName,
        profileName: params.profileName,
        totalCount: params.count,
        createdBy: params.createdBy,
      })
      .returning();

    // Push to RouterOS in chunks of 50 to avoid timeout
    const chunkSize = 50;
    const routerosIds: Record<string, string> = {};

    for (let i = 0; i < codes.length; i += chunkSize) {
      const chunk = codes.slice(i, i + chunkSize);
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

    // Save all vouchers to PostgreSQL
    const voucherRecords = codes.map((code) => ({
      batchId: batch.id,
      companyId: params.companyId,
      deviceId: params.deviceId,
      code,
      profileName: params.profileName,
      status: 'unused' as VoucherStatus,
      comment: params.comment,
      routerosId: routerosIds[code],
    }));

    await this.db.insert(vouchers).values(voucherRecords);

    // Mark batch as pushed
    await this.db
      .update(voucherBatches)
      .set({ pushedToDevice: true, pushedAt: new Date() })
      .where(eq(voucherBatches.id, batch.id));

    this.logger.log(
      `✓ Generated and pushed ${params.count} vouchers to device ${params.deviceId}`,
    );

    return { batchId: batch.id, vouchers: codes };
  }

  /**
   * Syncs voucher usage status from RouterOS back to PostgreSQL.
   * This is the ONLY source of truth for voucher state.
   */
  async syncVoucherStatus(deviceId: string, companyId: string): Promise<void> {
    const api = await this.getConnection(deviceId);

    // Get all active (currently connected) users
    const activeUsers = await api.write('/ip/hotspot/active/print');
    const activeUserMap = new Map<string, any>();
    (activeUsers as any[]).forEach((u) => activeUserMap.set(u['user'], u));

    // Get all users in RouterOS hotspot
    const allUsers = await api.write('/ip/hotspot/user/print');

    // Get DB vouchers for this device
    const dbVouchers = await this.db
      .select()
      .from(vouchers)
      .where(and(eq(vouchers.deviceId, deviceId), eq(vouchers.companyId, companyId)));

    const voucherMap = new Map(dbVouchers.map((v) => [v.code, v]));

    // Update statuses
    for (const rosUser of allUsers as any[]) {
      const code = rosUser['name'];
      const dbVoucher = voucherMap.get(code);
      if (!dbVoucher) continue;

      const isActive = activeUserMap.has(code);
      const bytesIn = parseInt(rosUser['bytes-in'] || '0');
      const bytesOut = parseInt(rosUser['bytes-out'] || '0');
      const uptime = rosUser['uptime'] || '0s';
      const disabled = rosUser['disabled'] === 'true';

      let status: VoucherStatus = dbVoucher.status as VoucherStatus;

      if (disabled) {
        status = VoucherStatus.DISABLED;
      } else if (isActive) {
        const activeUser = activeUserMap.get(code);
        status = VoucherStatus.ACTIVE;
        await this.db
          .update(vouchers)
          .set({
            status,
            usedBy: activeUser['address'],
            usedByMac: activeUser['mac-address'],
            usedByIp: activeUser['address'],
            usedAt: dbVoucher.usedAt || new Date(),
            bytesIn,
            bytesOut,
            uptime,
            updatedAt: new Date(),
          })
          .where(eq(vouchers.id, dbVoucher.id));
      } else if (bytesIn > 0 || bytesOut > 0) {
        // Has been used but not currently active
        status = VoucherStatus.EXPIRED;
        await this.db
          .update(vouchers)
          .set({ status, bytesIn, bytesOut, uptime, updatedAt: new Date() })
          .where(eq(vouchers.id, dbVoucher.id));
      }
    }

    await this.db
      .update(devices)
      .set({ lastSyncAt: new Date() })
      .where(eq(devices.id, deviceId));

    this.logger.log(`✓ Voucher sync complete for device ${deviceId}`);
  }

  async getActiveHotspotUsers(deviceId: string): Promise<HotspotActiveUser[]> {
    const api = await this.getConnection(deviceId);
    const active = await api.write('/ip/hotspot/active/print');

    return (active as any[]).map((u) => ({
      id: u['.id'],
      user: u['user'],
      address: u['address'],
      macAddress: u['mac-address'],
      uptime: u['uptime'],
      bytesIn: parseInt(u['bytes-in'] || '0'),
      bytesOut: parseInt(u['bytes-out'] || '0'),
      server: u['server'],
    }));
  }

  async kickHotspotUser(deviceId: string, activeId: string): Promise<void> {
    const api = await this.getConnection(deviceId);
    await api.write('/ip/hotspot/active/remove', [`=.id=${activeId}`]);
  }

  // ── FTP Template Upload ───────────────────────────────────

  /**
   * Accepts a ZIP file path, extracts HTML/CSS hotspot template,
   * uploads it to MikroTik flash memory via FTP, then activates it.
   */
  async uploadHotspotTemplate(
    deviceId: string,
    zipFilePath: string,
    templateName: string,
  ): Promise<void> {
    // Load device for FTP credentials
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

    // Extract ZIP to temp directory
    const tmpDir = path.join(os.tmpdir(), `sira-template-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const zip = new AdmZip(zipFilePath);
    zip.extractAllTo(tmpDir, true);

    // Validate it's a valid hotspot template (must have login.html)
    const loginHtml = path.join(tmpDir, 'login.html');
    if (!fs.existsSync(loginHtml)) {
      fs.rmSync(tmpDir, { recursive: true });
      throw new BadRequestException(
        'ملف القالب غير صالح: يجب أن يحتوي على login.html في الجذر',
      );
    }

    // Upload via FTP
    await new Promise<void>((resolve, reject) => {
      const ftp = new FTP();

      ftp.on('ready', async () => {
        const remotePath = `/hotspot/${templateName}`;

        // Create remote directory
        await new Promise<void>((res, rej) =>
          ftp.mkdir(remotePath, true, (err) => (err ? rej(err) : res())),
        );

        // Upload all files
        const files = this.getAllFilesRecursive(tmpDir);
        for (const file of files) {
          const relativePath = path.relative(tmpDir, file).replace(/\\/g, '/');
          const remoteFile = `${remotePath}/${relativePath}`;
          const remoteDir = path.dirname(remoteFile).replace(/\\/g, '/');

          await new Promise<void>((res, rej) =>
            ftp.mkdir(remoteDir, true, (err) => (err ? rej(err) : res())),
          );

          await new Promise<void>((res, rej) =>
            ftp.put(file, remoteFile, (err) => (err ? rej(err) : res())),
          );
        }

        ftp.end();
        resolve();
      });

      ftp.on('error', reject);

      ftp.connect({
        host,
        port: 21,
        user: creds.username,
        password: creds.password,
      });
    });

    // Set active hotspot profile via API
    const api = await this.getConnection(deviceId);

    // Find the first hotspot server and update its HTML directory
    const servers = await api.write('/ip/hotspot/print');
    if (servers.length > 0) {
      const serverId = (servers[0] as any)['.id'];
      await api.write('/ip/hotspot/set', [
        `=.id=${serverId}`,
        `=html-directory=hotspot/${templateName}`,
      ]);
    }

    // Cleanup temp files
    fs.rmSync(tmpDir, { recursive: true });

    this.logger.log(`✓ Template "${templateName}" uploaded and activated on device ${deviceId}`);
  }

  // ── CPE / Access Point Control ────────────────────────────

  /**
   * Routes commands through MikroTik to a downstream CPE device.
   * The CPE must be accessible via the MikroTik's local network.
   */
  async sendCpeCommand(
    mikrotikDeviceId: string,
    cpeIp: string,
    command: 'set_ssid' | 'set_password' | 'reboot' | 'get_clients' | 'get_signal',
    params?: Record<string, string>,
  ): Promise<any> {
    const api = await this.getConnection(mikrotikDeviceId);

    switch (command) {
      case 'set_ssid': {
        // Works for MikroTik CPE (CAPsMAN or simple AP)
        const result = await api.write('/interface/wireless/set', [
          `=ssid=${params?.ssid}`,
          `=comment=managed_by_sira`,
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

      case 'reboot': {
        // Schedule reboot via the tunnel
        await api.write('/system/reboot');
        return { success: true, message: 'إعادة التشغيل قيد التنفيذ' };
      }

      case 'get_clients': {
        const clients = await api.write('/interface/wireless/registration-table/print');
        return clients;
      }

      case 'get_signal': {
        const signal = await api.write('/interface/wireless/registration-table/print', [
          '=.proplist=signal-strength,tx-rate,rx-rate,mac-address',
        ]);
        return signal;
      }

      default:
        throw new BadRequestException(`أمر غير معروف: ${command}`);
    }
  }

  // ── Terminal (Raw API Shell) ──────────────────────────────

  /**
   * Executes a raw RouterOS command and returns the output.
   * Used by the WebBox terminal feature.
   */
  async executeTerminalCommand(
    deviceId: string,
    command: string,
  ): Promise<{ output: string; error?: string }> {
    const api = await this.getConnection(deviceId);

    // Security: block dangerous commands in non-super-admin sessions
    const BLOCKED_COMMANDS = [
      '/system/reset-configuration',
      '/system/format-storage',
      '/certificate/remove',
    ];

    const normalizedCmd = command.trim().toLowerCase().replace(/\s+/g, '/');
    for (const blocked of BLOCKED_COMMANDS) {
      if (normalizedCmd.includes(blocked.toLowerCase())) {
        return { output: '', error: '⛔ هذا الأمر محظور لأسباب أمنية' };
      }
    }

    try {
      // Parse RouterOS command format: /path/to/command =param=value
      const parts = command.trim().split(' ');
      const cmdPath = parts[0];
      const cmdParams = parts.slice(1).filter((p) => p.startsWith('=') || p.startsWith('?'));

      const result = await api.write(cmdPath, cmdParams);
      return { output: JSON.stringify(result, null, 2) };
    } catch (err) {
      return { output: '', error: err.message };
    }
  }

  // ── Helpers ───────────────────────────────────────────────

  private getAllFilesRecursive(dir: string): string[] {
    const files: string[] = [];
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        files.push(...this.getAllFilesRecursive(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    return files;
  }
}
