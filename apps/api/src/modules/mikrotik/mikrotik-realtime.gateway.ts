// ============================================================
// SEERA PLATFORM v4 - MikroTik Realtime Gateway
// Namespace: /ws/mikrotik
// Broadcasts a per-device realtime snapshot every 30s to the
// owning tenant's room. Reuses the existing socket.io + JWT infra;
// no Redis / BullMQ / new transport is introduced.
// ============================================================
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { Server, Socket } from 'socket.io';
import { AuthTokenPayload, UserRole } from '@sira/shared';
import { MikroTikService } from './mikrotik.service';

interface AuthedSocket extends Socket {
  user?: AuthTokenPayload;
}

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/ws/mikrotik',
})
export class MikroTikRealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MikroTikRealtimeGateway.name);
  /** socket.id → set of deviceIds the socket explicitly subscribed to. */
  private readonly subscriptions = new Map<string, Set<string>>();
  private broadcasting = false;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mikrotik: MikroTikService,
  ) {}

  async handleConnection(client: AuthedSocket): Promise<void> {
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

      // Tenant isolation via rooms.
      if (payload.companyId) client.join(`company:${payload.companyId}`);
      if (payload.role === UserRole.SUPER_ADMIN) client.join('super_admin');

      this.logger.log(`MikroTik realtime socket connected: ${client.id} (${payload.email})`);
    } catch {
      client.emit('error', { message: 'رمز التوثيق غير صالح' });
      client.disconnect();
    }
  }

  /**
   * Free the per-socket subscription set on disconnect. Without this the
   * subscriptions Map grows unbounded as sockets churn (memory leak).
   */
  handleDisconnect(client: AuthedSocket): void {
    if (this.subscriptions.delete(client.id)) {
      this.logger.debug(`MikroTik realtime socket disconnected: ${client.id}`);
    }
  }

  /**
   * Client may scope the stream to specific devices it owns. Ownership is
   * verified per device; unauthorized ids are silently skipped.
   */
  @SubscribeMessage('mikrotik:subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { deviceIds: string[] },
  ): Promise<void> {
    if (!client.user) return;
    const set = new Set<string>();
    for (const id of data?.deviceIds || []) {
      try {
        await this.mikrotik.assertDeviceOwned(id, client.user);
        set.add(id);
      } catch { /* not owned → skip */ }
    }
    this.subscriptions.set(client.id, set);
    client.emit('mikrotik:subscribed', { deviceIds: [...set] });
  }

  /**
   * Every 30s, push a realtime snapshot for every active MikroTik device to
   * its owning company room (and super-admins). Reentrancy-guarded so a slow
   * cycle never overlaps the next tick.
   */
  @Interval(30_000)
  async broadcastSnapshots(): Promise<void> {
    if (this.broadcasting || !this.server) return;
    this.broadcasting = true;
    try {
      const targets = await this.mikrotik.getActiveMikrotikDeviceIds();
      for (const { id, companyId } of targets) {
        // Skip devices nobody is listening to (saves router round-trips).
        const room = this.server.to(`company:${companyId}`).to('super_admin');
        try {
          const snapshot = await this.mikrotik.getRealtimeSnapshot(id);
          room.emit('mikrotik:realtime', snapshot);
        } catch (err: any) {
          this.logger.debug(`Snapshot failed for ${id}: ${err?.message}`);
        }
      }
    } finally {
      this.broadcasting = false;
    }
  }
}
