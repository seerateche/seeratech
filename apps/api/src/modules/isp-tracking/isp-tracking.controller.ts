// ============================================================
// SEERA PLATFORM v4 - ISP Tracking Controller
// All routes require JWT. Mutation routes require admin role.
// ============================================================
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MinLength, Matches } from 'class-validator';
import { IspTrackingService } from './isp-tracking.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/auth.service';
import { UserRole } from '@sira/shared';

// ── Request DTOs (with validation) ───────────────────────────

export class CreateIspAccountBody {
  @IsString()
  @IsNotEmpty({ message: 'اسم الحساب مطلوب' })
  accountName: string;

  @IsString()
  @Matches(/^0[2-9]\d{7,8}$/, {
    message: 'يجب أن يكون رقم التليفون الأرضي 9 أو 10 أرقام شاملاً كود المحافظة',
  })
  phoneNumber: string;

  @IsString()
  @MinLength(6, { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' })
  password: string;

  @IsOptional()
  @IsString()
  provider?: string;
}

export class UpdateIspAccountBody {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  accountName?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}

// ── Helper: extract companyId from JWT payload ────────────────
function companyIdFromReq(req: any): string {
  const companyId = req.user?.companyId;
  if (!companyId) {
    throw new BadRequestException('لا يمكن تحديد الشركة من رمز التوثيق');
  }
  return companyId;
}

// ── Controller ────────────────────────────────────────────────

@ApiTags('isp-tracking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('isp-tracking')
export class IspTrackingController {
  constructor(private readonly ispService: IspTrackingService) {}

  // ── GET /isp-tracking ─────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all ISP accounts for the company' })
  @ApiResponse({ status: 200, description: 'Returns account list with last quota snapshot' })
  async listAccounts(@Req() req: any) {
    const companyId = companyIdFromReq(req);
    const accounts  = await this.ispService.listAccounts(companyId);
    return {
      success:   true,
      data:      accounts,
      timestamp: new Date().toISOString(),
    };
  }

  // ── GET /isp-tracking/:id ─────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get a single ISP account' })
  async getAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Req()                         req: any,
  ) {
    const companyId = companyIdFromReq(req);
    const account   = await this.ispService.getAccount(id, companyId);
    return { success: true, data: account, timestamp: new Date().toISOString() };
  }

  // ── POST /isp-tracking ────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Add a new ISP account (admin only)' })
  async createAccount(
    @Body(ValidationPipe) body: CreateIspAccountBody,
    @Req()                      req: any,
  ) {
    const companyId = companyIdFromReq(req);
    const account   = await this.ispService.createAccount(
      companyId,
      body,
      req.user?.sub,
    );
    return { success: true, data: account, timestamp: new Date().toISOString() };
  }

  // ── PUT /isp-tracking/:id ─────────────────────────────────

  @Put(':id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update account name or password (admin only)' })
  async updateAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe)          body: UpdateIspAccountBody,
    @Req()                         req: any,
  ) {
    const companyId = companyIdFromReq(req);
    const account   = await this.ispService.updateAccount(id, companyId, body);
    return { success: true, data: account, timestamp: new Date().toISOString() };
  }

  // ── DELETE /isp-tracking/:id ─────────────────────────────

  @Delete(':id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an ISP account (admin only)' })
  async deleteAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Req()                         req: any,
  ) {
    const companyId = companyIdFromReq(req);
    await this.ispService.deleteAccount(id, companyId);
  }

  // ── POST /isp-tracking/:id/sync ──────────────────────────

  @Post(':id/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger manual quota sync for one account' })
  @ApiResponse({ status: 200, description: 'Updated account with fresh quota data' })
  @ApiResponse({ status: 500, description: 'WE API error (message in Arabic)' })
  async syncAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Req()                         req: any,
  ) {
    const companyId = companyIdFromReq(req);
    const account   = await this.ispService.syncAccountQuota(id, companyId);
    return { success: true, data: account, timestamp: new Date().toISOString() };
  }

  // ── POST /isp-tracking/sync-all ──────────────────────────

  @Post('sync-all')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync all active ISP accounts for the company (admin only)' })
  async syncAll(@Req() req: any) {
    const companyId = companyIdFromReq(req);
    const result    = await this.ispService.syncAllAccounts(companyId);
    return { success: true, data: result, timestamp: new Date().toISOString() };
  }
}
