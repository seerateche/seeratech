// ============================================================
// SEERA PLATFORM v4 - Auth Controller
// Exposes /auth/login, /auth/refresh, /auth/logout
// ============================================================
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
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
  ) {}

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
