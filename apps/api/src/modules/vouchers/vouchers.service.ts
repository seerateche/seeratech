// ============================================================
// SEERA PLATFORM v4 - Vouchers Service
// ============================================================
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DRIZZLE_TOKEN, DrizzleDB } from '../../database/database.module';
import {
  vouchers,
  voucherBatches,
  companies,
} from '../../database/schema';
import { MikroTikService } from '../mikrotik/mikrotik.service';
import { VoucherPdfService } from './voucher-pdf.service';
import { AuthTokenPayload, GenerateVouchersDto, UserRole } from '@sira/shared';

@Injectable()
export class VouchersService {
  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDB,
    private readonly mikrotik: MikroTikService,
    private readonly pdf: VoucherPdfService,
  ) {}

  private scope(user: AuthTokenPayload) {
    return user.role === UserRole.SUPER_ADMIN ? null : user.companyId;
  }

  async list(user: AuthTokenPayload) {
    const companyId = this.scope(user);
    const rows = companyId
      ? await this.db
          .select()
          .from(vouchers)
          .where(eq(vouchers.companyId, companyId))
          .orderBy(desc(vouchers.createdAt))
          .limit(500)
      : await this.db
          .select()
          .from(vouchers)
          .orderBy(desc(vouchers.createdAt))
          .limit(500);

    return rows.map((v) => ({
      id: v.id,
      batchId: v.batchId,
      code: v.code,
      profileName: v.profileName,
      status: v.status,
      usedBy: v.usedBy ?? undefined,
      usedAt: v.usedAt?.toISOString?.() ?? undefined,
      expiresAt: v.expiresAt?.toISOString?.() ?? undefined,
      companyId: v.companyId,
    }));
  }

  async listBatches(user: AuthTokenPayload) {
    const companyId = this.scope(user);
    const rows = companyId
      ? await this.db
          .select()
          .from(voucherBatches)
          .where(eq(voucherBatches.companyId, companyId))
          .orderBy(desc(voucherBatches.createdAt))
      : await this.db
          .select()
          .from(voucherBatches)
          .orderBy(desc(voucherBatches.createdAt));

    return Promise.all(
      rows.map(async (b) => {
        const counts = await this.db
          .select({ status: vouchers.status, count: sql<number>`count(*)::int` })
          .from(vouchers)
          .where(eq(vouchers.batchId, b.id))
          .groupBy(vouchers.status);

        const tally = { unused: 0, active: 0, expired: 0, disabled: 0 } as Record<string, number>;
        counts.forEach((c) => (tally[c.status] = c.count));

        return {
          batchId: b.id,
          batchName: b.name,
          profileName: b.profileName,
          total: b.totalCount,
          unused: tally.unused ?? 0,
          active: tally.active ?? 0,
          expired: tally.expired ?? 0,
          createdAt: b.createdAt?.toISOString?.() ?? null,
        };
      }),
    );
  }

  async generate(user: AuthTokenPayload, dto: GenerateVouchersDto) {
    const companyId =
      user.role === UserRole.SUPER_ADMIN ? dto.companyId : user.companyId!;
    return this.mikrotik.generateAndPushVouchers({
      deviceId: dto.deviceId,
      companyId,
      batchName: dto.batchName,
      profileName: dto.profileName,
      count: dto.count,
      prefix: dto.prefix,
      comment: dto.comment,
      createdBy: user.sub,
    });
  }

  async syncFromDevice(user: AuthTokenPayload, deviceId: string) {
    const companyId =
      user.role === UserRole.SUPER_ADMIN ? null : user.companyId;
    await this.mikrotik.syncVoucherStatus(deviceId, companyId ?? '', user);
    return { synced: true };
  }

  async exportPdf(user: AuthTokenPayload, batchId?: string): Promise<Buffer> {
    const companyId = this.scope(user);

    const baseWhere = batchId
      ? eq(vouchers.batchId, batchId)
      : companyId
        ? eq(vouchers.companyId, companyId)
        : undefined;

    const rows = baseWhere
      ? await this.db.select().from(vouchers).where(baseWhere).limit(1000)
      : await this.db.select().from(vouchers).limit(1000);

    if (rows.length === 0) throw new NotFoundException('لا توجد كروت للتصدير');

    let companyName = 'Seera Platform';
    if (rows[0]?.companyId) {
      const [c] = await this.db
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, rows[0].companyId))
        .limit(1);
      if (c) companyName = c.name;
    }

    return this.pdf.generateVoucherPdf(
      rows.map((v) => ({
        code: v.code,
        profileName: v.profileName,
        batchName: '',
        companyName,
        expiresAt: v.expiresAt?.toISOString?.() ?? undefined,
      })),
      { title: 'كروت الإنترنت' },
    );
  }
}
