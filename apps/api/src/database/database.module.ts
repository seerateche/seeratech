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
        const pool = new Pool({
          host: config.get<string>('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', 5432),
          database: config.get<string>('DB_NAME', 'sira_db'),
          user: config.get<string>('DB_USER', 'sira'),
          password: config.get<string>('DB_PASSWORD', 'sira_secret'),
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
          ssl: config.get('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
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
