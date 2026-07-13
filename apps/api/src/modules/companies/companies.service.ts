// ============================================================
// SEERA PLATFORM v4 - Companies / Admin Service
// ============================================================
import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, sql, and } from 'drizzle-orm';
import { DRIZZLE_TOKEN, DrizzleDB } from '../../database/database.module';
import { companies, devices, vouchers, users } from '../../database/schema';
import { CreateCompanyDto } from '@sira/shared';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class CompaniesService {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDB) {}

  /** Global list of all companies with aggregate counts (Super Admin). */
  async listCompanies() {
    // Avoid the previous N+1 pattern (2 queries per company). Use a fixed
    // number of grouped aggregate queries (3 total) regardless of company count.
    const [rows, deviceCounts, voucherCounts] = await Promise.all([
      this.db.select().from(companies),
      this.db
        .select({
          companyId: devices.companyId,
          count: sql<number>`count(*)::int`,
        })
        .from(devices)
        .groupBy(devices.companyId),
      this.db
        .select({
          companyId: vouchers.companyId,
          count: sql<number>`count(*)::int`,
        })
        .from(vouchers)
        .where(eq(vouchers.status, 'active'))
        .groupBy(vouchers.companyId),
    ]);

    const deviceMap = new Map(deviceCounts.map((d) => [d.companyId, d.count]));
    const voucherMap = new Map(voucherCounts.map((v) => [v.companyId, v.count]));

    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      status: c.status,
      country: c.country,
      city: c.city,
      deviceCount: deviceMap.get(c.id) ?? 0,
      activeVouchers: voucherMap.get(c.id) ?? 0,
      lastSeen: null,
      createdAt: c.createdAt?.toISOString?.() ?? null,
    }));
  }

  /** Global platform statistics for the God-Mode dashboard. */
  async globalStats() {
    const [{ count: totalCompanies }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(companies);
    const [{ count: totalDevices }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(devices);
    const [{ count: onlineDevices }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(devices)
      .where(eq(devices.status, 'online'));
    const [{ count: totalUsers }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);
    const [{ count: totalVouchers }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(vouchers);

    return {
      totalCompanies: totalCompanies ?? 0,
      totalDevices: totalDevices ?? 0,
      onlineDevices: onlineDevices ?? 0,
      totalUsers: totalUsers ?? 0,
      totalVouchers: totalVouchers ?? 0,
    };
  }

  /** Devices that belong to a specific company. */
  async companyDevices(companyId: string) {
    const company = await this.db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
    if (company.length === 0) throw new NotFoundException('الشركة غير موجودة');

    const rows = await this.db
      .select()
      .from(devices)
      .where(eq(devices.companyId, companyId));

    return rows.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      status: d.status,
      host: d.host,
      port: d.port,
      useVpn: d.useVpn,
      vpnIp: d.vpnIp ?? undefined,
      lastSeen: d.lastSeenAt?.toISOString?.() ?? null,
      companyId: d.companyId,
    }));
  }

  /** Per-company dashboard summary. */
  async dashboard(companyId: string | null) {
    if (!companyId) {
      // Super admin without a company context → return platform overview
      return this.globalStats();
    }

    const [{ count: deviceCount }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(devices)
      .where(eq(devices.companyId, companyId));
    const [{ count: onlineDevices }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(devices)
      .where(and(eq(devices.companyId, companyId), eq(devices.status, 'online')));
    const [{ count: activeVouchers }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(vouchers)
      .where(and(eq(vouchers.companyId, companyId), eq(vouchers.status, 'active')));
    const [{ count: totalVouchers }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(vouchers)
      .where(eq(vouchers.companyId, companyId));

    const [company] = await this.db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    return {
      company: company
        ? { id: company.id, name: company.name, slug: company.slug, status: company.status }
        : null,
      deviceCount: deviceCount ?? 0,
      onlineDevices: onlineDevices ?? 0,
      activeVouchers: activeVouchers ?? 0,
      totalVouchers: totalVouchers ?? 0,
    };
  }

  async createCompany(dto: CreateCompanyDto) {
    const [created] = await this.db
      .insert(companies)
      .values({
        name: dto.name,
        slug: dto.slug,
        country: dto.country,
        city: dto.city,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        maxDevices: dto.maxDevices ?? 10,
        maxVouchers: dto.maxVouchers ?? 1000,
      })
      .returning();
    return created;
  }

  /**
   * Reset the password of the single admin user belonging to a company.
   * Only callable by Super Admin (enforced at controller level).
   */
  async resetCompanyAdminPassword(companyId: string, newPassword: string): Promise<void> {
    // Verify company exists
    const [company] = await this.db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
    if (!company) throw new NotFoundException('الشركة غير موجودة');

    // Find the single admin user of this company
    const [user] = await this.db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.companyId, companyId))
      .limit(1);
    if (!user) throw new NotFoundException('لا يوجد مستخدم مرتبط بهذه الشركة');

    if (newPassword.length < 6) {
      throw new BadRequestException('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.db
      .update(users)
      .set({ passwordHash, refreshTokenHash: null }) // Invalidate any active sessions
      .where(eq(users.id, user.id));
  }

  /**
   * Get the single admin user info for a company (for display in God Mode).
   */
  async getCompanyAdminInfo(companyId: string) {
    const [company] = await this.db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
    if (!company) throw new NotFoundException('الشركة غير موجودة');

    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.companyId, companyId))
      .limit(1);

    return user ?? null;
  }
