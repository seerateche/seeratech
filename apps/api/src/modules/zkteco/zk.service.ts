// ============================================================
// SIRA PLATFORM v4 - ZKTeco Biometric Service
// ============================================================
import { Injectable, Logger, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import { DRIZZLE_TOKEN, DrizzleDB } from '../../database/database.module';
import { devices, attendanceLogs, employees } from '../../database/schema';
import { SecurityService } from '../../security/security.service';
import { AttendanceEventType } from '@sira/shared';

// ZKLib types
interface ZKUser {
  uid: number;
  userId: string;
  name: string;
  password: string;
  role: number;
  cardno: number;
}

interface ZKAttendanceRecord {
  uid: number;
  id: string;
  state: number;
  timestamp: Date;
  type: number;
}

@Injectable()
export class ZkService {
  private readonly logger = new Logger(ZkService.name);
  // Active ZKTeco device connections
  private readonly zkConnections = new Map<string, any>();
  // Track real-time listeners
  private readonly realtimeListeners = new Map<string, boolean>();

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDB,
    private readonly security: SecurityService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private async getZkInstance(deviceId: string, companyId: string): Promise<any> {
    if (this.zkConnections.has(deviceId)) {
      return this.zkConnections.get(deviceId);
    }

    const [device] = await this.db
      .select()
      .from(devices)
      .where(eq(devices.id, deviceId))
      .limit(1);

    if (!device) throw new Error(`جهاز البصمة ${deviceId} غير موجود`);
    if (device.companyId !== companyId) throw new Error('غير مصرح لك بالوصول لهذا الجهاز');

    const creds = this.security.decryptCredentials(
      device.encryptedUsername,
      device.encryptedPassword,
      device.credentialIv,
      device.credentialTag,
    );

    const host = device.useVpn && device.vpnIp ? device.vpnIp : device.host;

    // Dynamic import of zklib
    const ZKLib = await import('zklib');
    const zk = new ZKLib(host, device.port || 4370, 10, 4000);

    await new Promise<void>((resolve, reject) => {
      zk.createSocket((err: Error | null) => {
        if (err) reject(new Error(`فشل الاتصال بجهاز ZKTeco: ${err.message}`));
        else resolve();
      });
    });

    this.zkConnections.set(deviceId, zk);
    this.logger.log(`✓ Connected to ZKTeco device [${device.name}] at ${host}:${device.port}`);

    await this.db
      .update(devices)
      .set({ status: 'online', lastSeenAt: new Date() })
      .where(eq(devices.id, deviceId));

    return zk;
  }

  // ── Pull All Logs ─────────────────────────────────────────

  /**
   * Pulls ALL attendance logs from the ZKTeco device and syncs to PostgreSQL.
   * Uses upsert to avoid duplicates.
   */
  async syncAttendanceLogs(deviceId: string, companyId: string): Promise<number> {
    const zk = await this.getZkInstance(deviceId, companyId);

    // Get employees (users) from the device
    const zkUsers: ZKUser[] = await new Promise((resolve, reject) => {
      zk.getUsers((err: Error | null, data: ZKUser[]) => {
        if (err) reject(err);
        else resolve(data || []);
      });
    });

    // Build employee name map
    const employeeNameMap = new Map<string, string>();
    for (const user of zkUsers) {
      employeeNameMap.set(user.userId, user.name);

      // Upsert employee to DB
      await this.db
        .insert(employees)
        .values({
          companyId,
          zkEmployeeId: parseInt(user.userId) || user.uid,
          name: user.name || `Employee ${user.userId}`,
        })
        .onConflictDoUpdate({
          target: [employees.companyId, employees.zkEmployeeId],
          set: { name: user.name || `Employee ${user.userId}`, updatedAt: new Date() },
        });
    }

    // Get attendance logs
    const zkLogs: ZKAttendanceRecord[] = await new Promise((resolve, reject) => {
      zk.getAttendances((err: Error | null, data: ZKAttendanceRecord[]) => {
        if (err) reject(err);
        else resolve(data || []);
      });
    });

    if (!zkLogs || zkLogs.length === 0) return 0;

    // Find employee IDs from DB
    const dbEmployees = await this.db
      .select()
      .from(employees)
      .where(eq(employees.companyId, companyId));

    const employeeDbMap = new Map(
      dbEmployees.map((e) => [e.zkEmployeeId.toString(), e.id]),
    );

    // Map ZK event type to our enum
    const mapEventType = (state: number): AttendanceEventType => {
      const mapping: Record<number, AttendanceEventType> = {
        0: AttendanceEventType.CHECK_IN,
        1: AttendanceEventType.CHECK_OUT,
        2: AttendanceEventType.BREAK_OUT,
        3: AttendanceEventType.BREAK_IN,
        4: AttendanceEventType.OVERTIME_IN,
        5: AttendanceEventType.OVERTIME_OUT,
      };
      return mapping[state] || AttendanceEventType.CHECK_IN;
    };

    // Batch insert with conflict ignore
    const records = zkLogs.map((log) => ({
      companyId,
      deviceId,
      employeeId: employeeDbMap.get(log.id) || null,
      zkEmployeeId: parseInt(log.id) || log.uid,
      employeeName: employeeNameMap.get(log.id) || `Employee ${log.id}`,
      eventType: mapEventType(log.state),
      timestamp: log.timestamp,
      verifyType: log.type || 0,
    }));

    // Insert in batches to avoid large queries
    const batchSize = 200;
    let inserted = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      try {
        await this.db
          .insert(attendanceLogs)
          .values(batch)
          .onConflictDoNothing();
        inserted += batch.length;
      } catch (err) {
        this.logger.warn(`Batch insert warning: ${err.message}`);
      }
    }

    await this.db
      .update(devices)
      .set({ lastSyncAt: new Date(), lastSeenAt: new Date() })
      .where(eq(devices.id, deviceId));

    this.logger.log(`✓ Synced ${inserted} attendance logs from device ${deviceId}`);
    return inserted;
  }

  // ── Real-time Listener ────────────────────────────────────

  /**
   * Starts real-time attendance event listener.
   * Emits events via EventEmitter2 for WebSocket broadcasting.
   */
  async startRealtimeListener(deviceId: string, companyId: string): Promise<void> {
    if (this.realtimeListeners.get(deviceId)) {
      this.logger.debug(`Real-time listener already active for device ${deviceId}`);
      return;
    }

    const zk = await this.getZkInstance(deviceId, companyId);

    zk.startMon((err: Error | null) => {
      if (err) {
        this.logger.error(`Failed to start monitor for device ${deviceId}: ${err.message}`);
        return;
      }
      this.realtimeListeners.set(deviceId, true);
      this.logger.log(`✓ Real-time listener started for device ${deviceId}`);
    });

    zk.on('attendanceRecord', async (record: ZKAttendanceRecord) => {
      try {
        // Get employee name from DB
        const [emp] = await this.db
          .select()
          .from(employees)
          .where(
            eq(employees.zkEmployeeId, parseInt(record.id) || record.uid),
          )
          .limit(1);

        const logEntry = {
          companyId,
          deviceId,
          employeeId: emp?.id || null,
          zkEmployeeId: parseInt(record.id) || record.uid,
          employeeName: emp?.name || `Employee ${record.id}`,
          eventType: this.mapState(record.state),
          timestamp: record.timestamp,
          verifyType: record.type || 0,
        };

        await this.db
          .insert(attendanceLogs)
          .values(logEntry)
          .onConflictDoNothing();

        // Emit real-time event for WebSocket broadcast
        this.eventEmitter.emit('attendance.new_log', {
          companyId,
          deviceId,
          log: {
            ...logEntry,
            id: 'new',
          },
        });
      } catch (err) {
        this.logger.error(`Error processing real-time attendance: ${err.message}`);
      }
    });
  }

  async stopRealtimeListener(deviceId: string): Promise<void> {
    const zk = this.zkConnections.get(deviceId);
    if (zk) {
      try {
        zk.stopMon();
      } catch {}
      this.realtimeListeners.delete(deviceId);
    }
  }

  // ── Attendance Reports ────────────────────────────────────

  async getAttendanceSummary(
    companyId: string,
    startDate: Date,
    endDate: Date,
    employeeId?: string,
  ) {
    const { between, and: dbAnd, eq: dbEq } = await import('drizzle-orm');

    const query = this.db
      .select()
      .from(attendanceLogs)
      .where(
        dbAnd(
          dbEq(attendanceLogs.companyId, companyId),
          between(attendanceLogs.timestamp, startDate, endDate),
        ),
      )
      .orderBy(attendanceLogs.timestamp);

    const logs = await query;

    // Group by employee and date
    const grouped = new Map<string, Map<string, any[]>>();
    for (const log of logs) {
      const empKey = log.zkEmployeeId.toString();
      const dateKey = log.timestamp.toISOString().split('T')[0];

      if (!grouped.has(empKey)) grouped.set(empKey, new Map());
      const empDays = grouped.get(empKey)!;
      if (!empDays.has(dateKey)) empDays.set(dateKey, []);
      empDays.get(dateKey)!.push(log);
    }

    // Build report
    const report = [];
    for (const [empId, days] of grouped) {
      for (const [date, dayLogs] of days) {
        const checkIn = dayLogs.find((l) => l.eventType === 'check_in');
        const checkOut = dayLogs.findLast((l) => l.eventType === 'check_out');

        let totalHours: number | null = null;
        if (checkIn && checkOut) {
          totalHours =
            (checkOut.timestamp.getTime() - checkIn.timestamp.getTime()) /
            3600000;
        }

        report.push({
          employeeId: empId,
          employeeName: dayLogs[0].employeeName,
          date,
          checkIn: checkIn?.timestamp?.toISOString() || null,
          checkOut: checkOut?.timestamp?.toISOString() || null,
          totalHours: totalHours ? Math.round(totalHours * 100) / 100 : null,
          status:
            !checkIn
              ? 'absent'
              : totalHours !== null && totalHours < 4
              ? 'half_day'
              : checkIn.timestamp.getHours() > 9
              ? 'late'
              : 'present',
        });
      }
    }

    return report;
  }

  private mapState(state: number): AttendanceEventType {
    const m: Record<number, AttendanceEventType> = {
      0: AttendanceEventType.CHECK_IN,
      1: AttendanceEventType.CHECK_OUT,
      2: AttendanceEventType.BREAK_OUT,
      3: AttendanceEventType.BREAK_IN,
      4: AttendanceEventType.OVERTIME_IN,
      5: AttendanceEventType.OVERTIME_OUT,
    };
    return m[state] || AttendanceEventType.CHECK_IN;
  }

  async disconnect(deviceId: string): Promise<void> {
    const zk = this.zkConnections.get(deviceId);
    if (zk) {
      try {
        zk.disconnect();
      } catch {}
      this.zkConnections.delete(deviceId);
      this.realtimeListeners.delete(deviceId);
    }
  }

  // ── Employee CRUD ─────────────────────────────────────────────

  async getEmployees(companyId: string) {
    const { eq: dbEq, desc: dbDesc, asc } = await import('drizzle-orm');
    return this.db
      .select()
      .from(employees)
      .where(dbEq(employees.companyId, companyId))
      .orderBy(asc(employees.name));
  }

  async createEmployee(companyId: string, data: any) {
    const { eq: dbEq } = await import('drizzle-orm');
    const [created] = await this.db
      .insert(employees)
      .values({
        companyId,
        zkEmployeeId: data.zkEmployeeId,
        name: data.name,
        department: data.department,
        position: data.position,
        email: data.email,
        phone: data.phone,
      })
      .returning();
    return created;
  }

  async updateEmployee(id: string, companyId: string, data: any) {
    const { eq: dbEq, and: dbAnd } = await import('drizzle-orm');
    const [updated] = await this.db
      .update(employees)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.department !== undefined && { department: data.department }),
        ...(data.position !== undefined && { position: data.position }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedAt: new Date(),
      })
      .where(dbAnd(dbEq(employees.id, id), dbEq(employees.companyId, companyId)))
      .returning();
    return updated;
  }

  async deleteEmployee(id: string, companyId: string) {
    const { eq: dbEq, and: dbAnd } = await import('drizzle-orm');
    await this.db
      .delete(employees)
      .where(dbAnd(dbEq(employees.id, id), dbEq(employees.companyId, companyId)));
  }

  async syncEmployeesFromDevice(deviceId: string, companyId: string): Promise<number> {
    const zk = await this.getZkInstance(deviceId, companyId);

    const zkUsers: ZKUser[] = await new Promise((resolve, reject) => {
      zk.getUsers((err: Error | null, data: ZKUser[]) => {
        if (err) reject(err);
        else resolve(data || []);
      });
    });

    let count = 0;
    const { eq: dbEq } = await import('drizzle-orm');
    for (const user of zkUsers) {
      await this.db
        .insert(employees)
        .values({
          companyId,
          zkEmployeeId: parseInt(user.userId) || user.uid,
          name: user.name || `موظف ${user.userId}`,
        })
        .onConflictDoUpdate({
          target: [employees.companyId, employees.zkEmployeeId],
          set: { name: user.name || `موظف ${user.userId}`, updatedAt: new Date() },
        });
      count++;
    }
    return count;
  }

  // ── Daily Stats ───────────────────────────────────────────────

  async getDailyStats(companyId: string, date: string) {
    const { eq: dbEq, and: dbAnd, gte: dbGte, lte: dbLte } = await import('drizzle-orm');

    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);

    const dayLogs = await this.db
      .select()
      .from(attendanceLogs)
      .where(
        dbAnd(
          dbEq(attendanceLogs.companyId, companyId),
          dbGte(attendanceLogs.timestamp, start),
          dbLte(attendanceLogs.timestamp, end),
        ),
      );

    const totalEmployees = await this.db
      .select()
      .from(employees)
      .where(dbEq(employees.companyId, companyId));

    // Group by employee
    const byEmployee = new Map<string, typeof dayLogs>();
    for (const log of dayLogs) {
      const key = log.zkEmployeeId.toString();
      if (!byEmployee.has(key)) byEmployee.set(key, []);
      byEmployee.get(key)!.push(log);
    }

    let present = 0;
    let late = 0;
    let totalHoursSum = 0;
    let hoursCount = 0;

    for (const [, logs] of byEmployee) {
      const checkIn = logs.find((l) => l.eventType === 'check_in');
      const checkOut = logs.findLast((l) => l.eventType === 'check_out');
      if (checkIn) {
        present++;
        // Late if after 09:00 UTC+3 = 06:00 UTC
        if (checkIn.timestamp.getUTCHours() >= 6) late++;
        if (checkOut) {
          const hours = (checkOut.timestamp.getTime() - checkIn.timestamp.getTime()) / 3600000;
          totalHoursSum += hours;
          hoursCount++;
        }
      }
    }

    const absent = Math.max(0, totalEmployees.length - present);
    const avgHours = hoursCount > 0 ? Math.round((totalHoursSum / hoursCount) * 10) / 10 : 0;

    return {
      date,
      totalEmployees: totalEmployees.length,
      present,
      absent,
      late,
      avgHours,
    };
  }

  // ── Excel Export ──────────────────────────────────────────────

  async exportToExcel(
    companyId: string,
    startDate: Date,
    endDate: Date,
    employeeId?: string,
  ): Promise<Buffer> {
    const report = await this.getAttendanceSummary(companyId, startDate, endDate, employeeId);

    // Build CSV as fallback (no external dependency needed)
    // Headers in Arabic + English
    const headers = [
      'اسم الموظف',
      'التاريخ',
      'وقت الحضور',
      'وقت الانصراف',
      'إجمالي الساعات',
      'الحالة',
    ];

    const statusAr: Record<string, string> = {
      present: 'حاضر',
      absent: 'غائب',
      late: 'متأخر',
      half_day: 'نصف يوم',
    };

    const rows = report.map((r: any) => [
      r.employeeName,
      r.date,
      r.checkIn ? new Date(r.checkIn).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—',
      r.checkOut ? new Date(r.checkOut).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—',
      r.totalHours !== null ? `${r.totalHours} ساعة` : '—',
      statusAr[r.status] ?? r.status,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    // Add UTF-8 BOM for Arabic Excel support
    const bom = '\uFEFF';
    return Buffer.from(bom + csvContent, 'utf8');
  }

  // ── Device Test ───────────────────────────────────────────────

  async testDeviceConnection(deviceId: string, companyId: string) {
    try {
      const zk = await this.getZkInstance(deviceId, companyId);

      // Try to fetch device info
      const info = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('انتهت مهلة الاتصال (10 ثوانٍ)')), 10000);
        zk.getInfo((err: Error | null, data: any) => {
          clearTimeout(timeout);
          if (err) reject(err);
          else resolve(data);
        });
      });

      return {
        success: true,
        message: 'تم الاتصال بنجاح',
        deviceInfo: info,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `فشل الاتصال: ${err.message}`,
      };
    }
  }
}
