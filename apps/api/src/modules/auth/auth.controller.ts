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
import { AuthService, JwtAuthGuard, Public } from './auth.service';
import { CurrentUser } from '../../common/current-user.decorator';
import { AuthTokenPayload } from '@sira/shared';

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

  // ── TEMP DEBUG: Remove after fixing login ─────────────────
  @Public()
  @Get('debug')
  async debug() {
    const checks: Record<string, any> = {};

    // 1. Check env vars
    checks.has_jwt_secret      = !!this.config.get('JWT_SECRET');
    checks.has_refresh_secret  = !!this.config.get('JWT_REFRESH_SECRET');
    checks.has_encryption_key  = !!this.config.get('ENCRYPTION_KEY');
    checks.encryption_key_len  = (this.config.get<string>('ENCRYPTION_KEY') || '').length;
    checks.has_database_url    = !!this.config.get('DATABASE_URL');
    checks.node_env            = this.config.get('NODE_ENV');

    // 2. Check DB tables exist
    try {
      const result = await this.db.execute(
        sql`SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' ORDER BY table_name`
      );
      checks.tables = (result as any).rows?.map((r: any) => r.table_name) ?? result;
      checks.db_connected = true;
    } catch (e: any) {
      checks.db_connected = false;
      checks.db_error = e.message;
    }

    // 3. Check users table has rows
    try {
      const count = await this.db.execute(sql`SELECT COUNT(*) as cnt FROM users`);
      checks.users_count = (count as any).rows?.[0]?.cnt ?? '?';
    } catch (e: any) {
      checks.users_count = `ERROR: ${e.message}`;
    }

    return checks;
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
}
