// ============================================================
// SEERA PLATFORM v4 - Database Seed Script
// Run: npx ts-node seed.ts
// ============================================================
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';
import * as schema from './src/database/schema';

async function seed() {
  console.log('🌱 Seeding Seera Platform database...');

  // Railway exposes a single DATABASE_URL; prefer it when present, otherwise
  // fall back to the individual DB_* variables used in local/compose dev.
  const databaseUrl = process.env.DATABASE_URL;
  const sslEnabled =
    process.env.DB_SSL === 'true' ||
    (!!databaseUrl && process.env.NODE_ENV === 'production');
  const ssl = sslEnabled ? { rejectUnauthorized: false } : false;

  const pool = databaseUrl
    ? new Pool({ connectionString: databaseUrl, ssl })
    : new Pool({
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME     || 'sira_db',
        user:     process.env.DB_USER     || 'sira',
        password: process.env.DB_PASSWORD || 'sira_secure_2025',
        ssl,
      });

  const db = drizzle(pool, { schema });

  // ── Super Admin ──────────────────────────────────────────
  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL || 'superadmin@seera.local';
  const superAdminPwd   = process.env.SEED_SUPER_ADMIN_PASSWORD || 'Change_Me_2025!';
  const superAdminName  = process.env.SEED_SUPER_ADMIN_NAME  || 'Super Administrator';

  const existing = await db.select().from(schema.users)
    .where(require('drizzle-orm').eq(schema.users.email, superAdminEmail)).limit(1);

  if (existing.length === 0) {
    const hash = await bcrypt.hash(superAdminPwd, 12);
    await db.insert(schema.users).values({
      email:        superAdminEmail,
      name:         superAdminName,
      passwordHash: hash,
      role:         'super_admin',
      companyId:    null,
      isActive:     true,
    });
    console.log(`✓ Super Admin created: ${superAdminEmail}`);
    console.log(`  Password: ${superAdminPwd}`);
    console.log('  ⚠️  CHANGE THIS PASSWORD IN PRODUCTION!');
  } else {
    console.log(`ℹ  Super Admin already exists: ${superAdminEmail}`);
  }

  // ── Sample Company ──────────────────────────────────────
  const sampleCompany = await db.select().from(schema.companies)
    .where(require('drizzle-orm').eq(schema.companies.slug, 'demo-isp')).limit(1);

  if (sampleCompany.length === 0) {
    const [company] = await db.insert(schema.companies).values({
      name:         'Demo ISP - Alexandria',
      slug:         'demo-isp',
      status:       'active',
      country:      'Egypt',
      city:         'Alexandria',
      contactEmail: 'admin@demo-isp.local',
      maxDevices:   20,
      maxVouchers:  5000,
    }).returning();

    // Company Admin
    const adminHash = await bcrypt.hash('Demo_Admin_2025!', 12);
    await db.insert(schema.users).values({
      companyId:    company.id,
      email:        'admin@demo-isp.local',
      name:         'مدير النظام',
      passwordHash: adminHash,
      role:         'company_admin',
      isActive:     true,
    });

    console.log(`✓ Sample company created: demo-isp`);
    console.log(`  Admin: admin@demo-isp.local / Demo_Admin_2025!`);
  }

  console.log('\n✅ Seed complete!');
  console.log('\n📋 Login Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Super Admin: ${superAdminEmail}`);
  console.log(`Password:    ${superAdminPwd}`);
  console.log('─────────────────────────────────────────');
  console.log('Company Slug: demo-isp');
  console.log('Company Admin: admin@demo-isp.local');
  console.log('Password:      Demo_Admin_2025!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
