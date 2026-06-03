// ============================================================
// SEERA PLATFORM v4 - Devices Service
// ============================================================
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE_TOKEN, DrizzleDB } from '../../database/database.module';
import { devices } from '../../database/schema';
import { SecurityService } from '../../security/security.service';
import { AuthTokenPayload, CreateDeviceDto, DeviceType, UserRole } from '@sira/shared';

@Injectable()
export class DevicesService {
  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDB,
    private readonly security: SecurityService,
  ) {}

  private scope(user: AuthTokenPayload) {
    // Super admin sees everything; others are scoped to their company.
    return user.role === UserRole.SUPER_ADMIN ? null : user.companyId;
  }

  async list(user: AuthTokenPayload) {
    const companyId = this.scope(user);
    const rows = companyId
      ? await this.db.select().from(devices).where(eq(devices.companyId, companyId))
      : await this.db.select().from(devices);

    return rows.map((d) => this.toSummary(d));
  }

  async create(user: AuthTokenPayload, dto: CreateDeviceDto) {
    const companyId =
      user.role === UserRole.SUPER_ADMIN ? dto.companyId : user.companyId;
    if (!companyId) throw new NotFoundException('لم يتم تحديد الشركة');

    const enc = this.security.encrypt(dto.username);
    const encPass = this.security.encrypt(dto.password);

    const [created] = await this.db
      .insert(devices)
      .values({
        companyId,
        name: dto.name,
        type: dto.type,
        host: dto.host,
        port: dto.port,
        apiPort: dto.apiPort,
        encryptedUsername: enc.ciphertext,
        encryptedPassword: encPass.ciphertext,
        credentialIv: enc.iv,
        credentialTag: enc.tag,
        useVpn: dto.useVpn ?? false,
        vpnIp: dto.vpnIp,
        description: dto.description,
        status: 'offline',
      })
      .returning();

    return this.toSummary(created);
  }

  async remove(user: AuthTokenPayload, id: string) {
    const device = await this.getOwned(user, id);
    await this.db.delete(devices).where(eq(devices.id, device.id));
    return { deleted: true, id: device.id };
  }

  async ping(user: AuthTokenPayload, id: string) {
    const device = await this.getOwned(user, id);
    // A real implementation would open a TCP socket / API session.
    // Here we record an attempt and return current status.
    await this.db
      .update(devices)
      .set({ lastSeenAt: new Date() })
      .where(eq(devices.id, device.id));
    return { id: device.id, status: device.status, reachable: false };
  }

  private async getOwned(user: AuthTokenPayload, id: string) {
    const companyId = this.scope(user);
    const where = companyId
      ? and(eq(devices.id, id), eq(devices.companyId, companyId))
      : eq(devices.id, id);
    const [device] = await this.db.select().from(devices).where(where).limit(1);
    if (!device) throw new NotFoundException('الجهاز غير موجود');
    return device;
  }

  private toSummary(d: typeof devices.$inferSelect) {
    return {
      id: d.id,
      name: d.name,
      type: d.type as DeviceType,
      status: d.status,
      host: d.host,
      port: d.port,
      useVpn: d.useVpn,
      vpnIp: d.vpnIp ?? undefined,
      lastSeen: d.lastSeenAt?.toISOString?.() ?? null,
      companyId: d.companyId,
    };
  }
}
