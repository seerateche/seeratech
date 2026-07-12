// ============================================================
// SEERA PLATFORM v4 - Attendance (ZKTeco) Controller
// ============================================================
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  ParseUUIDPipe,
  Query,
  Body,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import { ZkService } from './zk.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/auth.service';
import { CurrentUser } from '../../common/current-user.decorator';
import { DRIZZLE_TOKEN, DrizzleDB } from '../../database/database.module';
import { attendanceLogs, employees } from '../../database/schema';
import { AuthTokenPayload, UserRole } from '@sira/shared';

// ── DTOs ──────────────────────────────────────────────────────
class CreateEmployeeDto {
  name: string;
  zkEmployeeId: number;
  department?: string;
  position?: string;
  email?: string;
  phone?: string;
  shiftStart?: string; // e.g. "08:00"
  shiftEnd?: string;   // e.g. "17:00"
}

class UpdateEmployeeDto {
  name?: string;
  department?: string;
  position?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
  shiftStart?: string;
  shiftEnd?: string;
}

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(
    private readonly zk: ZkService,
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDB,
  ) {}

  // ── Logs ─────────────────────────────────────────────────────

  @Get('logs')
  @ApiOperation({ summary: 'Get attendance logs with optional date filter' })
  async logs(
    @CurrentUser() user: AuthTokenPayload,
    @Query('date') date?: string,
    @Query('limit') limit?: string,
  ) {
    const companyId = user.companyId;
    if (!companyId && user.role !== UserRole.SUPER_ADMIN) return [];

    const conditions = [];
    if (companyId) conditions.push(eq(attendanceLogs.companyId, companyId));
    if (date) {
      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(`${date}T23:59:59.999Z`);
      conditions.push(gte(attendanceLogs.timestamp, start));
      conditions.push(lte(attendanceLogs.timestamp, end));
    }

    const rows = await this.db
      .select()
      .from(attendanceLogs)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(attendanceLogs.timestamp))
      .limit(parseInt(limit ?? '500'));

    return rows.map((r) => ({
      id: r.id,
      deviceId: r.deviceId,
      employeeId: r.employeeId ?? '',
      employeeName: r.employeeName ?? '',
      eventType: r.eventType,
      timestamp: r.timestamp?.toISOString?.() ?? null,
      companyId: r.companyId,
      verifyType: r.verifyType,
    }));
  }

  // ── Stats ─────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Get today attendance stats: present, absent, late, total hours' })
  async stats(
    @CurrentUser() user: AuthTokenPayload,
    @Query('date') date?: string,
  ) {
    const companyId = user.companyId;
    if (!companyId) return { present: 0, absent: 0, late: 0, totalEmployees: 0, avgHours: 0 };
    const targetDate = date ?? new Date().toISOString().split('T')[0];
    return this.zk.getDailyStats(companyId, targetDate);
  }

  // ── Report ───────────────────────────────────────────────────

  @Get('report')
  @ApiOperation({ summary: 'Get attendance report for a date range' })
  report(
    @CurrentUser() user: AuthTokenPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    const companyId = user.companyId;
    if (!companyId) return [];
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 86400000);
    const end = endDate ? new Date(`${endDate}T23:59:59.999Z`) : new Date();
    return this.zk.getAttendanceSummary(companyId, start, end, employeeId);
  }

  @Get('report/export')
  @ApiOperation({ summary: 'Export attendance report as Excel file' })
  async exportReport(
    @CurrentUser() user: AuthTokenPayload,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('employeeId') employeeId: string,
    @Res() res: Response,
  ) {
    const companyId = user.companyId;
    if (!companyId) {
      res.status(403).json({ message: 'غير مصرح' });
      return;
    }
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 86400000);
    const end = endDate ? new Date(`${endDate}T23:59:59.999Z`) : new Date();

    const buffer = await this.zk.exportToExcel(companyId, start, end, employeeId);
    const filename = `attendance_${startDate ?? 'week'}_to_${endDate ?? 'today'}.xlsx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ── Employees ─────────────────────────────────────────────────

  @Get('employees')
  @ApiOperation({ summary: 'List all employees for this company' })
  async getEmployees(@CurrentUser() user: AuthTokenPayload) {
    const companyId = user.companyId;
    if (!companyId) return [];
    return this.zk.getEmployees(companyId);
  }

  @Post('employees')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Create employee manually' })
  createEmployee(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.zk.createEmployee(user.companyId ?? '', dto);
  }

  @Put('employees/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Update employee data' })
  updateEmployee(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.zk.updateEmployee(id, user.companyId ?? '', dto);
  }

  @Delete('employees/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete employee' })
  deleteEmployee(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.zk.deleteEmployee(id, user.companyId ?? '');
  }

  @Get('employees/:id/logs')
  @ApiOperation({ summary: 'Get logs for a specific employee' })
  async getEmployeeLogs(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const companyId = user.companyId;
    if (!companyId) return [];
    const conditions = [
      eq(attendanceLogs.companyId, companyId),
      eq(attendanceLogs.employeeId, id),
    ];
    if (startDate) conditions.push(gte(attendanceLogs.timestamp, new Date(startDate)));
    if (endDate) conditions.push(lte(attendanceLogs.timestamp, new Date(`${endDate}T23:59:59.999Z`)));

    const rows = await this.db
      .select()
      .from(attendanceLogs)
      .where(and(...conditions))
      .orderBy(desc(attendanceLogs.timestamp))
      .limit(500);

    return rows.map((r) => ({
      id: r.id,
      eventType: r.eventType,
      timestamp: r.timestamp?.toISOString?.() ?? null,
      verifyType: r.verifyType,
    }));
  }

  @Post('employees/sync-from-device/:deviceId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Import employees from ZKTeco device into DB' })
  async syncEmployeesFromDevice(
    @CurrentUser() user: AuthTokenPayload,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    const count = await this.zk.syncEmployeesFromDevice(deviceId, user.companyId ?? '');
    return { synced: count };
  }

  // ── Sync ──────────────────────────────────────────────────────

  @Post('sync/:deviceId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Sync attendance logs from ZKTeco device' })
  async sync(
    @CurrentUser() user: AuthTokenPayload,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    const count = await this.zk.syncAttendanceLogs(deviceId, user.companyId ?? '');
    return { synced: count };
  }

  @Post('devices/:deviceId/test')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Test connection to a ZKTeco device' })
  async testDevice(
    @CurrentUser() user: AuthTokenPayload,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    return this.zk.testDeviceConnection(deviceId, user.companyId ?? '');
  }
}
