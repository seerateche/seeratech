// ============================================================
// SEERA PLATFORM v4 - Companies / Admin / Dashboard Controllers
// ============================================================
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/auth.service';
import { CurrentUser } from '../../common/current-user.decorator';
import { UserRole } from '@sira/shared';

export class CreateCompanyBody {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() slug: string;
  @IsString() @IsNotEmpty() country: string;
  @IsString() @IsNotEmpty() city: string;
  @IsEmail() contactEmail: string;
  @IsOptional() @IsString() contactPhone?: string;
}

export class ResetPasswordBody {
  @IsString()
  @IsNotEmpty({ message: 'كلمة المرور الجديدة مطلوبة' })
  @MinLength(6, { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' })
  newPassword: string;
}

// ── Admin / God-Mode routes ───────────────────────────────────
@ApiTags('companies')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly companies: CompaniesService) {}

  @Get('companies')
  @Roles(UserRole.SUPER_ADMIN)
  listCompanies() {
    return this.companies.listCompanies();
  }

  @Get('stats')
  @Roles(UserRole.SUPER_ADMIN)
  stats() {
    return this.companies.globalStats();
  }

  @Get('companies/:id/devices')
  @Roles(UserRole.SUPER_ADMIN)
  companyDevices(@Param('id', ParseUUIDPipe) id: string) {
    return this.companies.companyDevices(id);
  }

  @Post('companies')
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() body: CreateCompanyBody) {
    return this.companies.createCompany(body);
  }

  /** GET admin user info for a specific company (Super Admin only) */
  @Get('companies/:id/admin')
  @Roles(UserRole.SUPER_ADMIN)
  getCompanyAdmin(@Param('id', ParseUUIDPipe) id: string) {
    return this.companies.getCompanyAdminInfo(id);
  }

  /** Reset the password of the single admin user of a company (Super Admin only) */
  @Post('companies/:id/reset-password')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ResetPasswordBody,
  ) {
    await this.companies.resetCompanyAdminPassword(id, body.newPassword);
    return { success: true, message: 'تم تغيير كلمة المرور بنجاح وإلغاء جميع الجلسات النشطة' };
  }
}

// ── Per-company dashboard ─────────────────────────────────────
@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  dashboard(@CurrentUser('companyId') companyId: string | null) {
    return this.companies.dashboard(companyId);
  }
}
