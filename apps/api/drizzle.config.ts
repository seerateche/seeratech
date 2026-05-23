import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config();

export default {
  schema:    './src/database/schema.ts',
  out:       './drizzle',
  dialect:   'postgresql',
  dbCredentials: {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'sira_db',
    user:     process.env.DB_USER     || 'sira',
    password: process.env.DB_PASSWORD || 'sira_secure_2025',
    ssl:      process.env.DB_SSL === 'true',
  },
  verbose: true,
  strict:  true,
} satisfies Config;
