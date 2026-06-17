// ============================================================
// SIRA PLATFORM v4 - Database Module
// ============================================================
import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DRIZZLE_TOKEN = Symbol('DRIZZLE_TOKEN');

export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Railway (and most managed Postgres providers) expose a single
        // DATABASE_URL connection string. Prefer it when present, otherwise
        // fall back to the individual DB_* variables used in local/compose dev.
        const databaseUrl = config.get<string>('DATABASE_URL');

        // Enable SSL automatically for managed providers (their URLs usually
        // require it) or when explicitly requested via DB_SSL=true.
        const sslEnabled =
          config.get('DB_SSL') === 'true' ||
          (!!databaseUrl && config.get('NODE_ENV') === 'production');
        const ssl = sslEnabled ? { rejectUnauthorized: false } : false;

        const pool = databaseUrl
          ? new Pool({
              connectionString: databaseUrl,
              max: 20,
              idleTimeoutMillis: 30000,
              connectionTimeoutMillis: 10000,
              ssl,
            })
          : new Pool({
              host: config.get<string>('DB_HOST', 'localhost'),
              port: config.get<number>('DB_PORT', 5432),
              database: config.get<string>('DB_NAME', 'sira_db'),
              user: config.get<string>('DB_USER', 'sira'),
              password: config.get<string>('DB_PASSWORD', 'sira_secret'),
              max: 20,
              idleTimeoutMillis: 30000,
              connectionTimeoutMillis: 10000,
              ssl,
            });

        pool.on('error', (err) => {
          console.error('PostgreSQL pool error:', err);
        });

        return drizzle(pool, { schema, logger: config.get('NODE_ENV') === 'development' });
      },
    },
  ],
  exports: [DRIZZLE_TOKEN],
})
export class DatabaseModule {}
