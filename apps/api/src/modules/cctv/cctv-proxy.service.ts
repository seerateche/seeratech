// ============================================================
// SIRA PLATFORM v4 - CCTV RTSP → HLS Streaming Proxy
// ============================================================
import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE_TOKEN, DrizzleDB } from '../../database/database.module';
import { devices } from '../../database/schema';
import { SecurityService } from '../../security/security.service';
import { AuthTokenPayload, UserRole } from '@sira/shared';

interface StreamSession {
  deviceId: string;
  ffmpegProcess: ffmpeg.FfmpegCommand;
  hlsDir: string;
  startedAt: Date;
  watcherCount: number;
}

@Injectable()
export class CctvProxyService {
  private readonly logger = new Logger(CctvProxyService.name);
  private readonly activeSessions = new Map<string, StreamSession>();
  private readonly HLS_BASE_DIR: string;
  // Auto-stop stream if no watchers for this duration
  private readonly IDLE_TIMEOUT_MS = 30_000;

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDB,
    private readonly security: SecurityService,
    private readonly config: ConfigService,
  ) {
    this.HLS_BASE_DIR = path.join(
      config.get('STORAGE_PATH', '/tmp/sira-streams'),
    );
    fs.mkdirSync(this.HLS_BASE_DIR, { recursive: true });
  }

  /**
   * Tenant isolation: resolves a device scoped to the caller's company.
   * Super-admins reach any device; everyone else only their own. Throws
   * NotFound (never leaks existence) for out-of-tenant devices.
   */
  private async assertDeviceOwned(
    deviceId: string,
    user?: AuthTokenPayload,
  ): Promise<typeof devices.$inferSelect> {
    const scopedCompanyId =
      user && user.role !== UserRole.SUPER_ADMIN ? user.companyId : null;

    const where = scopedCompanyId
      ? and(eq(devices.id, deviceId), eq(devices.companyId, scopedCompanyId))
      : eq(devices.id, deviceId);

    const [device] = await this.db.select().from(devices).where(where).limit(1);
    if (!device) throw new NotFoundException('كاميرا CCTV غير موجودة');
    return device;
  }

  /**
   * Starts an RTSP → HLS transcoding session for a CCTV device.
   * Returns the HLS manifest URL path.
   */
  async startStream(
    deviceId: string,
    user?: AuthTokenPayload,
  ): Promise<{ hlsUrl: string; sessionId: string }> {
    // Tenant isolation: verify the caller owns this camera before doing
    // anything — including reusing an existing session. Throws NotFound
    // (never leaks existence) for cameras outside the caller's company.
    const device = await this.assertDeviceOwned(deviceId, user);

    // Return existing session if active
    if (this.activeSessions.has(deviceId)) {
      const session = this.activeSessions.get(deviceId)!;
      session.watcherCount++;
      return {
        hlsUrl: `/streams/${deviceId}/index.m3u8`,
        sessionId: deviceId,
      };
    }

    if (device.type !== 'dvr' && device.type !== 'nvr') {
      throw new NotFoundException('الجهاز ليس DVR/NVR');
    }

    // Decrypt credentials
    const creds = this.security.decryptCredentials(
      device.encryptedUsername,
      device.encryptedPassword,
      device.credentialIv,
      device.credentialTag,
    );

    const host = device.useVpn && device.vpnIp ? device.vpnIp : device.host;
    // Standard RTSP URL format for most DVR/NVR systems
    const rtspUrl = `rtsp://${creds.username}:${creds.password}@${host}:${device.port || 554}/Streaming/Channels/101`;

    // Create HLS output directory for this stream
    const hlsDir = path.join(this.HLS_BASE_DIR, deviceId);
    fs.mkdirSync(hlsDir, { recursive: true });

    const hlsPlaylist = path.join(hlsDir, 'index.m3u8');
    const hlsSegment = path.join(hlsDir, 'segment%03d.ts');

    this.logger.log(`Starting RTSP stream for device ${device.name}`);

    const ffmpegCmd = ffmpeg(rtspUrl)
      .inputOptions([
        '-rtsp_transport tcp', // Use TCP for RTSP (more reliable than UDP)
        '-re',                  // Read input at native frame rate
      ])
      .videoCodec('libx264')
      .videoBitrate('800k')
      .size('1280x720')
      .fps(15)
      .audioCodec('aac')
      .audioBitrate('64k')
      .outputOptions([
        '-f hls',
        '-hls_time 2',           // 2-second segments for low latency
        '-hls_list_size 5',      // Keep last 5 segments
        '-hls_flags delete_segments+append_list',
        '-hls_segment_type mpegts',
        `-hls_segment_filename ${hlsSegment}`,
        '-preset ultrafast',    // Fastest encoding for live streaming
        '-tune zerolatency',
        '-g 30',                // GOP size
        '-sc_threshold 0',
      ])
      .output(hlsPlaylist);

    ffmpegCmd.on('start', (cmdLine) => {
      this.logger.debug(`FFmpeg started: ${cmdLine}`);
    });

    ffmpegCmd.on('error', (err, stdout, stderr) => {
      this.logger.error(`FFmpeg error for device ${deviceId}: ${err.message}`);
      this.activeSessions.delete(deviceId);
    });

    ffmpegCmd.on('end', () => {
      this.logger.log(`FFmpeg stream ended for device ${deviceId}`);
      this.activeSessions.delete(deviceId);
    });

    ffmpegCmd.run();

    // Wait for first segment to appear (up to 10 seconds)
    await this.waitForStream(hlsPlaylist);

    const session: StreamSession = {
      deviceId,
      ffmpegProcess: ffmpegCmd,
      hlsDir,
      startedAt: new Date(),
      watcherCount: 1,
    };

    this.activeSessions.set(deviceId, session);

    return {
      hlsUrl: `/streams/${deviceId}/index.m3u8`,
      sessionId: deviceId,
    };
  }

  async stopStream(deviceId: string, user?: AuthTokenPayload): Promise<void> {
    // Tenant isolation: only the owner (or super-admin) may stop a stream.
    await this.assertDeviceOwned(deviceId, user);

    const session = this.activeSessions.get(deviceId);
    if (!session) return;

    session.watcherCount--;
    if (session.watcherCount > 0) return; // Other viewers still watching

    try {
      (session.ffmpegProcess as any).kill('SIGTERM');
    } catch {}

    // Clean up HLS segments
    setTimeout(() => {
      try {
        fs.rmSync(session.hlsDir, { recursive: true, force: true });
      } catch {}
    }, 5000);

    this.activeSessions.delete(deviceId);
    this.logger.log(`Stream stopped for device ${deviceId}`);
  }

  getStreamStatus(deviceId: string): {
    active: boolean;
    startedAt?: Date;
    watchers?: number;
  } {
    const session = this.activeSessions.get(deviceId);
    if (!session) return { active: false };
    return {
      active: true,
      startedAt: session.startedAt,
      watchers: session.watcherCount,
    };
  }

  getHlsSegmentPath(deviceId: string, filename: string): string | null {
    const safeName = path.basename(filename); // Prevent path traversal
    const filePath = path.join(this.HLS_BASE_DIR, deviceId, safeName);

    if (!filePath.startsWith(this.HLS_BASE_DIR)) return null; // Double-check traversal
    if (!fs.existsSync(filePath)) return null;

    return filePath;
  }

  private async waitForStream(playlistPath: string, timeoutMs = 10000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (fs.existsSync(playlistPath)) {
        const content = fs.readFileSync(playlistPath, 'utf8');
        if (content.includes('#EXTM3U') && content.includes('.ts')) return;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new InternalServerErrorException(
      'فشل تشغيل بث الكاميرا: انتهت مهلة الاتصال',
    );
  }

  async getActiveStreams(
    user?: AuthTokenPayload,
  ): Promise<Array<{ deviceId: string; startedAt: Date; watchers: number }>> {
    const sessions = Array.from(this.activeSessions.values());
    if (sessions.length === 0) return [];

    // Tenant isolation: super-admins see all active streams; everyone else
    // only sees streams for devices owned by their own company.
    if (user && user.role !== UserRole.SUPER_ADMIN) {
      if (!user.companyId) return [];
      const owned = await this.db
        .select({ id: devices.id })
        .from(devices)
        .where(eq(devices.companyId, user.companyId));
      const ownedIds = new Set(owned.map((d) => d.id));
      return sessions
        .filter((s) => ownedIds.has(s.deviceId))
        .map((s) => ({
          deviceId: s.deviceId,
          startedAt: s.startedAt,
          watchers: s.watcherCount,
        }));
    }

    return sessions.map((s) => ({
      deviceId: s.deviceId,
      startedAt: s.startedAt,
      watchers: s.watcherCount,
    }));
  }

  // Cleanup on module destroy
  async onModuleDestroy(): Promise<void> {
    for (const [deviceId] of this.activeSessions) {
      await this.stopStream(deviceId);
    }
  }
}
