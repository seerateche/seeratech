import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config();

// Railway (and most managed Postgres providers) expose a single
// DATABASE_URL connection string. Prefer it when present, otherwise fall
// back to the individual DB_* variables used in local/compose dev. This is
// what lets `drizzle-kit migrate` work on Railway.
const databaseUrl = process.env.DATABASE_URL;

const dbCredentials = databaseUrl
  ? { connectionString: databaseUrl }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'sira_db',
      user: process.env.DB_USER || 'sira',
      password: process.env.DB_PASSWORD || 'sira_secret',
      ssl: process.env.DB_SSL === 'true',
    };

export default {
  schema: './src/database/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials,
  verbose: true,
  strict: true,
} satisfies Config;
