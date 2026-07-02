// ============================================================
// SIRA PLATFORM v4 - WebSocket Gateway (Terminal + Real-time)
// ============================================================
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { UseGuards, Logger, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { DRIZZLE_TOKEN, DrizzleDB } from '../../database/database.module';
import { terminalSessions, users } from '../../database/schema';
import { MikroTikService } from '../mikrotik/mikrotik.service';
import { AuthTokenPayload, UserRole, WsEvent } from '@sira/shared';

interface AuthenticatedSocket extends Socket {
  user: AuthTokenPayload;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/ws',
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AppGateway.name);
  // Map socket.id → terminal session info
  private readonly terminalSessions = new Map<
    string,
    { deviceId: string; sessionId: string; companyId: string | null }
  >();

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDB,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mikrotik: MikroTikService,
  ) {}

  // ── Connection Auth ───────────────────────────────────────

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        client.emit('error', { message: 'رمز التوثيق مفقود' });
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(token, {
        secret: this.config.get('JWT_SECRET'),
      });

      client.user = payload;

      // Join company room for tenant isolation
      if (payload.companyId) {
        client.join(`company:${payload.companyId}`);
      }

      // Super admin joins all-companies room
      if (payload.role === UserRole.SUPER_ADMIN) {
        client.join('super_admin');
      }

      this.logger.log(`Socket connected: ${client.id} (${payload.email})`);
    } catch (err) {
      client.emit('error', { message: 'رمز التوثيق غير صالح' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    // Close terminal session if active
    const session = this.terminalSessions.get(client.id);
    if (session) {
      await this.closeTerminalSession(client.id, session.sessionId);
    }
    this.logger.log(`Socket disconnected: ${client.id}`);
  }

  // ── Terminal (WebBox) ─────────────────────────────────────

  @SubscribeMessage(WsEvent.TERMINAL_INIT)
  async handleTerminalInit(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { deviceId: string },
  ): Promise<void> {
    const user = client.user;

    // Only super_admin and company_admin can use terminal
    if (user.role === UserRole.VIEWER) {
      client.emit(WsEvent.TERMINAL_ERROR, {
        message: 'غير مصرح لك بالوصول إلى الطرفية',
      });
      return;
    }

    const { deviceId } = data;

    try {
      await this.mikrotik.assertDeviceOwned(deviceId, user);
      
      // Create audit session
      const sessionToken = uuidv4();
      const [session] = await this.db
        .insert(terminalSessions)
        .values({
          userId: user.sub,
          deviceId,
          companyId: user.companyId,
          sessionToken,
          ipAddress: client.handshake.address,
          userAgent: client.handshake.headers['user-agent'],
        })
        .returning();

      this.terminalSessions.set(client.id, {
        deviceId,
        sessionId: session.id,
        companyId: user.companyId,
      });

      client.emit(WsEvent.TERMINAL_OUTPUT, {
        output:
          '╔══════════════════════════════════════════╗\r\n' +
          '║     Sira Platform v4 - RouterOS Terminal  ║\r\n' +
          '╚══════════════════════════════════════════╝\r\n' +
          `\r\nمتصل بالجهاز: ${deviceId}\r\n` +
          'اكتب الأوامر أدناه:\r\n\r\n',
      });

      this.logger.log(
        `Terminal session started: user=${user.email}, device=${deviceId}`,
      );
    } catch (err) {
      client.emit(WsEvent.TERMINAL_ERROR, {
        message: `فشل الاتصال بالطرفية: ${err.message}`,
      });
    }
  }

  @SubscribeMessage(WsEvent.TERMINAL_INPUT)
  async handleTerminalInput(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { command: string },
  ): Promise<void> {
    const session = this.terminalSessions.get(client.id);
    if (!session) {
      client.emit(WsEvent.TERMINAL_ERROR, {
        message: 'لا توجد جلسة طرفية نشطة. استخدم TERMINAL_INIT أولاً',
      });
      return;
    }

    const { command } = data;
    if (!command?.trim()) return;

    // Echo command back to client
    client.emit(WsEvent.TERMINAL_OUTPUT, {
      output: `\r\n[${new Date().toLocaleTimeString()}] > ${command}\r\n`,
    });

    try {
      const result = await this.mikrotik.executeTerminalCommand(
        session.deviceId,
        command,
        client.user,
      );

      if (result.error) {
        client.emit(WsEvent.TERMINAL_OUTPUT, {
          output: `⚠ خطأ: ${result.error}\r\n`,
        });
      } else {
        client.emit(WsEvent.TERMINAL_OUTPUT, {
          output: result.output + '\r\n',
        });
      }

      // Append to session command log
      const [existing] = await this.db
        .select({ log: terminalSessions.commandLog })
        .from(terminalSessions)
        .where(eq(terminalSessions.id, session.sessionId));
      const updatedLog = `${existing?.log || ''}\n[${new Date().toISOString()}] ${command}`;
      await this.db
        .update(terminalSessions)
        .set({ commandLog: updatedLog })
        .where(eq(terminalSessions.id, session.sessionId));
    } catch (err) {
      client.emit(WsEvent.TERMINAL_ERROR, {
        message: err.message,
      });
    }
  }

  @SubscribeMessage(WsEvent.TERMINAL_CLOSE)
  async handleTerminalClose(
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    const session = this.terminalSessions.get(client.id);
    if (session) {
      await this.closeTerminalSession(client.id, session.sessionId);
      client.emit(WsEvent.TERMINAL_OUTPUT, {
        output: '\r\n✓ تم إغلاق الجلسة\r\n',
      });
    }
  }

  private async closeTerminalSession(
    socketId: string,
    sessionId: string,
  ): Promise<void> {
    await this.db
      .update(terminalSessions)
      .set({ endedAt: new Date(), isActive: false })
      .where(eq(terminalSessions.id, sessionId));
    this.terminalSessions.delete(socketId);
  }

  // ── Event Listeners (from services) ──────────────────────

  @OnEvent('attendance.new_log')
  handleAttendanceLog(payload: { companyId: string; deviceId: string; log: any }): void {
    this.server
      .to(`company:${payload.companyId}`)
      .emit(WsEvent.ATTENDANCE_NEW_LOG, payload.log);
  }

  @OnEvent('device.status_change')
  handleDeviceStatusChange(payload: {
    deviceId: string;
    companyId: string;
    status: string;
  }): void {
    this.server
      .to(`company:${payload.companyId}`)
      .emit(WsEvent.DEVICE_STATUS_CHANGE, payload);

    // Also notify super admin
    this.server.to('super_admin').emit(WsEvent.DEVICE_STATUS_CHANGE, payload);
  }

  @OnEvent('hotspot.user_connect')
  handleHotspotUserConnect(payload: any): void {
    this.server
      .to(`company:${payload.companyId}`)
      .emit(WsEvent.HOTSPOT_USER_CONNECT, payload);
  }

  // ── Broadcast Helpers ─────────────────────────────────────

  broadcastToCompany(companyId: string, event: string, data: any): void {
    this.server.to(`company:${companyId}`).emit(event, data);
  }

  broadcastToSuperAdmin(event: string, data: any): void {
    this.server.to('super_admin').emit(event, data);
  }

  broadcastToAll(event: string, data: any): void {
    this.server.emit(event, data);
  }
}
