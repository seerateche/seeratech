// ============================================================
// SEERA PLATFORM v4 - Attendance (ZKTeco) Controller
// ============================================================
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import { ZkService } from './zk.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/auth.service';
import { CurrentUser } from '../../common/current-user.decorator';
import { DRIZZLE_TOKEN, DrizzleDB } from '../../database/database.module';
import { attendanceLogs } from '../../database/schema';
import { AuthTokenPayload, UserRole } from '@sira/shared';

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(
    private readonly zk: ZkService,
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDB,
  ) {}

  @Get('logs')
  async logs(
    @CurrentUser() user: AuthTokenPayload,
    @Query('date') date?: string,
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
      .limit(500);

    return rows.map((r) => ({
      id: r.id,
      deviceId: r.deviceId,
      employeeId: r.employeeId ?? '',
      employeeName: r.employeeName ?? '',
      eventType: r.eventType,
      timestamp: r.timestamp?.toISOString?.() ?? null,
      companyId: r.companyId,
    }));
  }

  @Get('report')
  report(
    @CurrentUser() user: AuthTokenPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    const companyId = user.companyId;
    if (!companyId) return [];
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 86400000);
    const end = endDate ? new Date(endDate) : new Date();
    return this.zk.getAttendanceSummary(companyId, start, end, employeeId);
  }

  @Post('sync/:deviceId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  async sync(
    @CurrentUser() user: AuthTokenPayload,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    const count = await this.zk.syncAttendanceLogs(deviceId, user.companyId ?? '', user);
    return { synced: count };
  }
}
