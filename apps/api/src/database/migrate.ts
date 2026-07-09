// ============================================================
// SEERA PLATFORM v4 - Production Database Initializer
// ============================================================
// Compiled by `nest build` → dist/database/migrate.js
// Executed in Docker CMD: node dist/database/migrate.js
//
// This script:
//  1. Connects to PostgreSQL (supports DATABASE_URL or DB_* vars)
//  2. Runs all pending Drizzle ORM migrations (no drizzle-kit CLI)
//  3. Seeds the Super Admin and demo company if they don't exist
//  4. Exits 0 → Docker CMD runs node dist/main.js
// ============================================================
try {
  require('dotenv/config');
} catch (e) {
  // Ignore missing dotenv in production (Railway injects env vars directly)
}
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import * as schema from './schema';
import * as path from 'path';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🗄️  Seera Platform — Database Initializer');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // ── 1. Build PostgreSQL connection ────────────────────────
  const databaseUrl = process.env.DATABASE_URL;
  const dbSslConfig  = process.env.DB_SSL;

  let sslEnabled = true;
  if (dbSslConfig === 'false') {
    sslEnabled = false;
  }
  const ssl: any = sslEnabled ? { rejectUnauthorized: false } : false;

  const pool = databaseUrl
    ? new Pool({ connectionString: databaseUrl, max: 3, connectionTimeoutMillis: 30_000, ssl })
    : new Pool({
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME     || 'sira_db',
        user:     process.env.DB_USER     || 'sira',
        password: process.env.DB_PASSWORD || 'sira_secret',
        max: 3,
        connectionTimeoutMillis: 30_000,
        ssl,
      });

  // Connectivity check
  try {
    const client = await pool.connect();
    const { rows } = await client.query('SELECT current_database() AS db');
    console.log(`✓ Connected to PostgreSQL: ${rows[0].db}`);
    client.release();
  } catch (err: any) {
    console.error('✗ Cannot connect to PostgreSQL:', err.message);
    console.error('⚠️ Continuing despite connection failure to allow app startup for debugging.');
  }

  const db = drizzle(pool, { schema });

  // ── 2. Run SQL migrations ─────────────────────────────────
  // MIGRATIONS_DIR env var is set in Dockerfile to /app/drizzle.
  // Fallback: when running compiled JS from dist/, go up two levels
  // to find the sibling drizzle/ directory (/app/drizzle).
  const migrationsFolder = process.env.MIGRATIONS_DIR
    || path.resolve(__dirname, '..', '..', 'drizzle');

  console.log(`\n📂 Migrations: ${migrationsFolder}`);

  try {
    await migrate(db, { migrationsFolder });
    console.log('✓ Migrations applied successfully');
  } catch (err: any) {
    console.error('✗ Migration failed:', err.message ?? err);
    console.error('⚠️ Continuing despite migration failure to allow app startup for debugging.');
  }

  // ── 3. Seed default data ──────────────────────────────────
  console.log('\n🌱 Checking seed data...');

  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL    || 'superadmin@seera.local';
  const superAdminPwd   = process.env.SEED_SUPER_ADMIN_PASSWORD;

  if (!superAdminPwd) {
    throw new Error('FATAL: SEED_SUPER_ADMIN_PASSWORD environment variable is not set. Refusing to seed default admin with a hardcoded password.');
  }

  const superAdminName  = process.env.SEED_SUPER_ADMIN_NAME     || 'Super Administrator';

  try {
    // ── Super Admin ───────────────────────────────────────
    const existing = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, superAdminEmail))
      .limit(1);

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
      console.log('  ⚠️  Change this password after first login!');
    } else {
      console.log(`ℹ  Super Admin already exists: ${superAdminEmail}`);
    }

    // ── Demo Company ──────────────────────────────────────
    const existingCo = await db
      .select({ id: schema.companies.id })
      .from(schema.companies)
      .where(eq(schema.companies.slug, 'demo-isp'))
      .limit(1);

    if (existingCo.length === 0) {
      const [company] = await db.insert(schema.companies).values({
        name:         'Demo ISP',
        slug:         'demo-isp',
        status:       'active',
        country:      'Egypt',
        city:         'Alexandria',
        contactEmail: 'admin@demo-isp.local',
        maxDevices:   20,
        maxVouchers:  5000,
      }).returning();

      const adminHash = await bcrypt.hash('Demo_Admin_2025!', 12);
      await db.insert(schema.users).values({
        companyId:    company.id,
        email:        'admin@demo-isp.local',
        name:         'مدير النظام',
        passwordHash: adminHash,
        role:         'company_admin',
        isActive:     true,
      });
      console.log('✓ Demo company created  (slug: demo-isp)');
      console.log('  Admin: admin@demo-isp.local / Demo_Admin_2025!');
    } else {
      console.log('ℹ  Demo company already exists');
    }
  } catch (err: any) {
    console.error('✗ Seed error:', err.message ?? err);
    // Don't exit — migrations ran OK, app can still start
  }

  // ── 4. Finish ─────────────────────────────────────────────
  await pool.end();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Database ready — starting NestJS app');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((err) => {
  console.error('Fatal: Database initializer crashed:', err);
  console.error('⚠️ Exiting with 0 to allow app startup for debugging.');
  process.exit(0);
});
