// ============================================================
// SEERA PLATFORM v4 - Production Database Initializer
// ============================================================
// This script runs BEFORE the NestJS app starts.  It is compiled
// to dist/database/migrate.js by `nest build` and executed in the
// Docker CMD via: node dist/database/migrate.js
//
// Strategy: Uses drizzle-orm/node-postgres/migrator to run the
// SQL migrations stored in the /app/drizzle directory.  Then
// seeds the database with default users if they don't exist.
//
// Why NOT drizzle-kit push: The CLI may prompt for interactive
// confirmation (Y/n) which hangs in non-interactive Docker.
// This programmatic approach is silent and deterministic.
// ============================================================
import 'dotenv/config';
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

  // ── 1. Create connection ──────────────────────────────────
  const databaseUrl = process.env.DATABASE_URL;
  const dbSslConfig = process.env.DB_SSL;

  // 🔥 التعديل الجذري: إجبار السكريبت على احترام DB_SSL="false"
  let sslEnabled = false;
  if (dbSslConfig === 'false') {
    sslEnabled = false;
  } else if (dbSslConfig === 'true') {
    sslEnabled = true;
  } else {
    sslEnabled = !!databaseUrl && process.env.NODE_ENV === 'production';
  }
  
  const ssl = sslEnabled ? { rejectUnauthorized: false } : false;

  const pool = databaseUrl
    ? new Pool({
        connectionString: databaseUrl,
        max: 3,
        connectionTimeoutMillis: 30_000,
        ssl,
      })
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

  // Quick connectivity check
  try {
    const client = await pool.connect();
    const { rows } = await client.query('SELECT current_database() AS db, version()');
    console.log(`✓ Connected to PostgreSQL: ${rows[0].db}`);
    client.release();
  } catch (err) {
    console.error('✗ Failed to connect to PostgreSQL:', err);
    process.exit(1);
  }

  const db = drizzle(pool, { schema });

  // ── 2. Run migrations ─────────────────────────────────────
  // The drizzle migrator looks for the SQL files + meta/_journal.json
  // in the specified folder.  In Docker, we copy them to /app/drizzle.
  const migrationsFolder = path.resolve(
    process.env.MIGRATIONS_DIR || path.join(__dirname, '../../drizzle'),
  );
  console.log(`\n📂 Migrations folder: ${migrationsFolder}`);

  try {
    await migrate(db, { migrationsFolder });
    console.log('✓ Migrations applied successfully');
  } catch (err: any) {
    // If the migrate function fails because there are no migration files
    // (e.g. first deploy using push), fall back to push-style schema sync.
    if (err.message?.includes('No config')) {
      console.warn('⚠ No migration files found — skipping migration step.');
      console.warn('  Generate them locally with: npx drizzle-kit generate');
    } else {
      console.error('✗ Migration failed:', err);
      process.exit(1);
    }
  }

  // ── 3. Seed default data ──────────────────────────────────
  console.log('\n🌱 Checking seed data...');

  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL    || 'superadmin@seera.local';
  const superAdminPwd   = process.env.SEED_SUPER_ADMIN_PASSWORD || 'Change_Me_2025!';
  const superAdminName  = process.env.SEED_SUPER_ADMIN_NAME     || 'Super Administrator';

  try {
    const existing = await db
      .select()
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
    } else {
      console.log(`ℹ  Super Admin already exists: ${superAdminEmail}`);
    }

    // Demo company
    const existingCompany = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.slug, 'demo-isp'))
      .limit(1);

    if (existingCompany.length === 0) {
      const [company] = await db
        .insert(schema.companies)
        .values({
          name:         'Demo ISP - Alexandria',
          slug:         'demo-isp',
          status:       'active',
          country:      'Egypt',
          city:         'Alexandria',
          contactEmail: 'admin@demo-isp.local',
          maxDevices:   20,
          maxVouchers:  5000,
        })
        .returning();

      const adminHash = await bcrypt.hash('Demo_Admin_2025!', 12);
      await db.insert(schema.users).values({
        companyId:    company.id,
        email:        'admin@demo-isp.local',
        name:         'مدير النظام',
        passwordHash: adminHash,
        role:         'company_admin',
        isActive:     true,
      });
      console.log('✓ Demo company created: demo-isp');
    } else {
      console.log('ℹ  Demo company already exists');
    }
  } catch (err: any) {
    // If tables don't exist yet (migration issue), log but don't crash.
    // The app will still start and can be debugged.
    if (err.message?.includes('relation') && err.message?.includes('does not exist')) {
      console.error('✗ Seed failed — tables do not exist. Check migrations.');
      console.error('  Error:', err.message);
    } else {
      console.error('✗ Seed error:', err);
    }
  }

  // ── 4. Done ───────────────────────────────────────────────
  await pool.end();
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Database initialization complete');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((err) => {
  console.error('Fatal: Database initialization failed:', err);
  process.exit(1);
});
