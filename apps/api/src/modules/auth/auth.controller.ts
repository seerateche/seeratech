// ============================================================
// SEERA PLATFORM v4 - Auth Controller
// Exposes /auth/login, /auth/refresh, /auth/logout
// ============================================================
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
  Query,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_TOKEN, DrizzleDB } from '../../database/database.module';
import { sql } from 'drizzle-orm';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AuthService, JwtAuthGuard, Public, RolesGuard, Roles } from './auth.service';
import { CurrentUser } from '../../common/current-user.decorator';
import { AuthTokenPayload, UserRole } from '@sira/shared';

// ── Request DTOs ──────────────────────────────────────────────

export class LoginBody {
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'كلمة المرور مطلوبة' })
  @MinLength(6, { message: 'كلمة المرور قصيرة جدًا' })
  password: string;

  @IsOptional()
  @IsString()
  companySlug?: string;
}

export class RefreshBody {
  @IsString()
  @IsNotEmpty({ message: 'رمز التجديد مطلوب' })
  refreshToken: string;
}

export class ChangePasswordBody {
  @IsString()
  @IsNotEmpty({ message: 'كلمة المرور الحالية مطلوبة' })
  currentPassword: string;

  @IsString()
  @IsNotEmpty({ message: 'كلمة المرور الجديدة مطلوبة' })
  @MinLength(6, { message: 'كلمة المرور الجديدة قصيرة جدًا' })
  newPassword: string;
}

// ── Controller ────────────────────────────────────────────────

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDB,
  ) {}

  // ── TEMP DEBUG: visit /api/v1/auth/debug to diagnose login ────
  // Shows whether the required env vars are present, whether the DB is
  // reachable, which tables exist, and how many users are seeded.
  @Public()
  @Get('debug')
  async debug(@Query('secret') secret?: string) {
    if (this.config.get('NODE_ENV') === 'production') {
      const expectedSecret = this.config.get('MIGRATION_SECRET');
      if (!expectedSecret || secret !== expectedSecret) {
        throw new UnauthorizedException('Unauthorized');
      }
    }
    const checks: Record<string, any> = {};

    // 1. Required env vars (booleans only — never leak secret values)
    checks.has_jwt_secret      = !!this.config.get('JWT_SECRET');
    checks.has_refresh_secret  = !!this.config.get('JWT_REFRESH_SECRET');
    checks.has_encryption_key  = !!this.config.get('ENCRYPTION_KEY');
    checks.encryption_key_len  = (this.config.get<string>('ENCRYPTION_KEY') || '').length;
    checks.has_database_url    = !!this.config.get('DATABASE_URL');
    checks.node_env            = this.config.get('NODE_ENV');
    checks.db_ssl              = this.config.get('DB_SSL') ?? '(unset → default)';

    // 2. Which Postgres are we actually connected to?
    try {
      const info = await this.db.execute(
        sql`SELECT current_database() AS db, current_user AS usr, version() AS ver`,
      );
      const row = (info as any).rows?.[0] ?? {};
      checks.db_connected = true;
      checks.db_name = row.db;
      checks.db_user = row.usr;
    } catch (e: any) {
      checks.db_connected = false;
      checks.db_error = e.message;
    }

    // 3. Which tables exist
    try {
      const result = await this.db.execute(
        sql`SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' ORDER BY table_name`,
      );
      checks.tables = (result as any).rows?.map((r: any) => r.table_name) ?? [];
      checks.tables_count = checks.tables.length;
    } catch (e: any) {
      checks.tables = `ERROR: ${e.message}`;
    }

    // 4. How many users are seeded
    try {
      const count = await this.db.execute(sql`SELECT COUNT(*) as cnt FROM users`);
      checks.users_count = (count as any).rows?.[0]?.cnt ?? '?';
    } catch (e: any) {
      checks.users_count = `ERROR: ${e.message}`;
    }

    // 5. Verdict — a human-readable summary of what to fix
    const problems: string[] = [];
    if (!checks.has_jwt_secret)     problems.push('JWT_SECRET missing');
    if (!checks.has_encryption_key) problems.push('ENCRYPTION_KEY missing');
    if (checks.has_encryption_key && checks.encryption_key_len !== 64)
      problems.push(`ENCRYPTION_KEY must be 64 hex chars (got ${checks.encryption_key_len})`);
    if (!checks.db_connected)       problems.push('cannot connect to database');
    if (checks.tables_count === 0)  problems.push('no tables — migrations did not run (POST /api/v1/auth/run-migrations)');
    if (checks.users_count === '0' || checks.users_count === 0)
      problems.push('no users — seed did not run');
    checks.verdict = problems.length ? problems : 'OK — login should work';

    return checks;
  }

  // ── TEMP: manually run migrations + seed if boot-time migrate failed ──
  // Protected by a one-time secret so it can't be abused. Set MIGRATION_SECRET
  // in the API service, then: POST /api/v1/auth/run-migrations  {"secret":"..."}
  @Public()
  @Post('run-migrations')
  @HttpCode(HttpStatus.OK)
  async runMigrations(@Body() body: { secret?: string }) {
    const expected = this.config.get<string>('MIGRATION_SECRET');
    if (!expected || body?.secret !== expected) {
      throw new UnauthorizedException('Invalid or missing migration secret');
    }

    const out: Record<string, any> = {};
    try {
      // Run the SQL migrations against the live connection.
      const { migrate } = await import('drizzle-orm/node-postgres/migrator');
      const path = await import('path');
      const migrationsFolder =
        process.env.MIGRATIONS_DIR || path.resolve(__dirname, '..', '..', '..', 'drizzle');
      out.migrationsFolder = migrationsFolder;
      await migrate(this.db as any, { migrationsFolder });
      out.migrations = 'applied';
    } catch (e: any) {
      out.migrations = `ERROR: ${e.message}`;
      return out;
    }

    // Seed default super admin if missing.
    try {
      const bcrypt = await import('bcryptjs');
      const email = this.config.get<string>('SEED_SUPER_ADMIN_EMAIL') || 'superadmin@seera.local';
      const pwd   = this.config.get<string>('SEED_SUPER_ADMIN_PASSWORD') || 'Change_Me_2025!';
      const existing = await this.db.execute(
        sql`SELECT 1 FROM users WHERE email = ${email} LIMIT 1`,
      );
      if (((existing as any).rows?.length ?? 0) === 0) {
        const hash = await bcrypt.hash(pwd, 12);
        await this.db.execute(
          sql`INSERT INTO users (email, name, password_hash, role, is_active)
              VALUES (${email}, 'Super Administrator', ${hash}, 'super_admin', true)`,
        );
        out.superAdmin = `created: ${email}`;
      } else {
        out.superAdmin = `already exists: ${email}`;
      }
    } catch (e: any) {
      out.superAdmin = `ERROR: ${e.message}`;
    }

    return out;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email + password' })
  async login(@Body() body: LoginBody) {
    return this.authService.login(body.email, body.password, body.companySlug);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using a refresh token' })
  async refresh(@Body() body: RefreshBody) {
    // Verify the refresh token signature first to extract the user id
    let payload: AuthTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AuthTokenPayload>(
        body.refreshToken,
        { secret: this.config.get<string>('JWT_REFRESH_SECRET') },
      );
    } catch {
      throw new UnauthorizedException('رمز التجديد غير صالح أو منتهي الصلاحية');
    }

    return this.authService.refreshTokens(payload.sub, body.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout — invalidates the stored refresh token' })
  async logout(@CurrentUser('sub') userId: string) {
    await this.authService.logout(userId);
    return { loggedOut: true };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change current user password — Super Admin only' })
  async changePassword(
    @CurrentUser('sub') userId: string,
    @Body() body: ChangePasswordBody,
  ) {
    await this.authService.changePassword(userId, body.currentPassword, body.newPassword);
    return { success: true };
  }
}
