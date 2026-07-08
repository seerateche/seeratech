// ============================================================
// SIRA PLATFORM v4 - Auth Module (JWT + RBAC)
// ============================================================
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  CanActivate,
  ExecutionContext,
  SetMetadata,
  Logger,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as bcrypt from 'bcryptjs';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE_TOKEN, DrizzleDB } from '../../database/database.module';
import { users, companies } from '../../database/schema';
import { AuthTokenPayload, UserRole } from '@sira/shared';

// ── Decorators ────────────────────────────────────────────────

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// NOTE: The real @CurrentUser param decorator lives in
// common/current-user.decorator.ts (built via createParamDecorator).
// A non-functional duplicate previously defined here was removed.

// ── JWT Strategy ──────────────────────────────────────────────

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: AuthTokenPayload): Promise<AuthTokenPayload> {
    return payload;
  }
}

// ── JWT Auth Guard ────────────────────────────────────────────

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDB,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) throw new UnauthorizedException('رمز التوثيق مفقود');

    try {
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });

      // Verify user still exists and is active
      const [user] = await this.db
        .select({ id: users.id, isActive: users.isActive, role: users.role })
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('الحساب غير نشط أو محذوف');
      }

      // Support God Mode: Allow Super Admin to operate in the context of a specific company
      if (payload.role === UserRole.SUPER_ADMIN) {
        const overrideCompanyId = request.headers['x-company-id'];
        if (overrideCompanyId) {
          payload.companyId = overrideCompanyId;
        }
      }

      request['user'] = payload;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('رمز التوثيق غير صالح أو منتهي الصلاحية');
    }
  }

  private extractTokenFromHeader(request: any): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : null;
  }
}

// ── Roles Guard ───────────────────────────────────────────────

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user: AuthTokenPayload }>();
    if (!user) throw new ForbiddenException('غير مصرح لك بالوصول');

    const hasRole = requiredRoles.some((role) => user.role === role);
    if (!hasRole) {
      throw new ForbiddenException(
        `هذا الإجراء يتطلب أحد الأدوار التالية: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}

// ── Auth Service ──────────────────────────────────────────────

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_ROUNDS = 12;
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCK_DURATION_MINUTES = 15;

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDB,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string, companySlug?: string) {
    // Find user
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    // Check account lock
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new UnauthorizedException(
        `الحساب مقفل. يرجى المحاولة بعد ${minutesLeft} دقيقة`,
      );
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.handleFailedLogin(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    // Super admin doesn't need company slug
    if (user.role !== UserRole.SUPER_ADMIN) {
      if (!user.companyId) {
        throw new UnauthorizedException('المستخدم غير مرتبط بشركة');
      }

      const [company] = await this.db
        .select({ id: companies.id, slug: companies.slug, status: companies.status })
        .from(companies)
        .where(eq(companies.id, user.companyId))
        .limit(1);

      if (!company) {
        throw new UnauthorizedException('الشركة غير موجودة');
      }

      if (company.status === 'suspended') {
        throw new ForbiddenException('حساب الشركة موقوف');
      }

      if (companySlug && company.slug !== companySlug) {
        throw new UnauthorizedException('الشركة غير موجودة');
      }
    }

    if (!user.isActive) {
      throw new ForbiddenException('الحساب معطل');
    }

    // Reset failed attempts & update login info
    await this.db
      .update(users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Get company name if applicable
    let companyName: string | undefined;
    if (user.companyId) {
      const [company] = await this.db
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, user.companyId))
        .limit(1);
      companyName = company?.name;
    }

    const payload: AuthTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
      companyId: user.companyId,
    };

    const jwtSecret        = this.config.get<string>('JWT_SECRET');
    const jwtRefreshSecret = this.config.get<string>('JWT_REFRESH_SECRET') || jwtSecret;

    if (!jwtSecret) {
      this.logger.error('JWT_SECRET is not set — cannot issue tokens');
      throw new Error('Server misconfiguration: JWT_SECRET missing');
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtSecret,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: jwtRefreshSecret,
        expiresIn: '7d',
      }),
    ]);

    // Store hashed refresh token
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.db
      .update(users)
      .set({ refreshTokenHash })
      .where(eq(users.id, user.id));

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as UserRole,
        companyId: user.companyId,
        companyName,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || !user.refreshTokenHash || !user.isActive) {
      throw new UnauthorizedException('رمز التجديد غير صالح');
    }

    const isTokenValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!isTokenValid) {
      throw new UnauthorizedException('رمز التجديد غير صالح');
    }

    const payload: AuthTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
      companyId: user.companyId,
    };

    const newAccessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: '15m',
    });

    return { accessToken: newAccessToken };
  }

  async logout(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({ refreshTokenHash: null })
      .where(eq(users.id, userId));
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.BCRYPT_ROUNDS);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new UnauthorizedException('المستخدم غير موجود');

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw new BadRequestException('كلمة المرور الحالية غير صحيحة');

    const passwordHash = await this.hashPassword(newPassword);
    
    await this.db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId));
  }

  private async handleFailedLogin(userId: string, currentAttempts: number): Promise<void> {
    const newAttempts = currentAttempts + 1;

    if (newAttempts >= this.MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(
        Date.now() + this.LOCK_DURATION_MINUTES * 60 * 1000,
      );
      await this.db
        .update(users)
        .set({ failedLoginAttempts: newAttempts, lockedUntil })
        .where(eq(users.id, userId));
    } else {
      await this.db
        .update(users)
        .set({ failedLoginAttempts: newAttempts })
        .where(eq(users.id, userId));
    }
  }
}
