// ============================================================
// SIRA PLATFORM v4 - Shared Types, Enums & DTOs
// ============================================================

// ── Enums ────────────────────────────────────────────────────

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  COMPANY_ADMIN = 'company_admin',
  VIEWER = 'viewer',
}

export enum DeviceType {
  MIKROTIK = 'mikrotik',
  DVR = 'dvr',
  NVR = 'nvr',
  BIOMETRIC = 'biometric',
  ACCESS_POINT = 'access_point',
}

export enum DeviceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  CONNECTING = 'connecting',
  ERROR = 'error',
}

export enum VoucherStatus {
  UNUSED = 'unused',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  DISABLED = 'disabled',
}

export enum CompanyStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  TRIAL = 'trial',
}

export enum AttendanceEventType {
  CHECK_IN = 'check_in',
  CHECK_OUT = 'check_out',
  BREAK_IN = 'break_in',
  BREAK_OUT = 'break_out',
  OVERTIME_IN = 'overtime_in',
  OVERTIME_OUT = 'overtime_out',
}

// ── Auth DTOs ─────────────────────────────────────────────────

export interface LoginDto {
  email: string;
  password: string;
  companySlug?: string;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  iat?: number;
  exp?: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string | null;
  companyName?: string;
  avatarUrl?: string;
}

// ── Company DTOs ──────────────────────────────────────────────

export interface CreateCompanyDto {
  name: string;
  slug: string;
  country: string;
  city: string;
  contactEmail: string;
  contactPhone?: string;
  maxDevices?: number;
  maxVouchers?: number;
}

export interface CompanySummary {
  id: string;
  name: string;
  slug: string;
  status: CompanyStatus;
  country: string;
  city: string;
  deviceCount: number;
  activeVouchers: number;
  lastSeen: string | null;
  createdAt: string;
}

// ── Device DTOs ───────────────────────────────────────────────

export interface CreateDeviceDto {
  companyId: string;
  name: string;
  type: DeviceType;
  host: string;
  port: number;
  username: string;
  password: string;
  apiPort?: number;
  useVpn?: boolean;
  vpnIp?: string;
  description?: string;
}

export interface DeviceSummary {
  id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  host: string;
  port: number;
  useVpn: boolean;
  vpnIp?: string;
  lastSeen: string | null;
  companyId: string;
}

export interface MikroTikStats {
  uptime: string;
  cpuLoad: number;
  memoryUsed: number;
  memoryTotal: number;
  hddUsed: number;
  hddTotal: number;
  activeHotspotUsers: number;
  totalInterfaces: number;
  boardName: string;
  version: string;
  serialNumber: string;
}

// ── Voucher DTOs ──────────────────────────────────────────────

export interface GenerateVouchersDto {
  deviceId: string;
  companyId: string;
  profileName: string;
  count: number;
  prefix?: string;
  comment?: string;
  batchName: string;
}

export interface VoucherRecord {
  id: string;
  batchId: string;
  batchName: string;
  code: string;
  profileName: string;
  status: VoucherStatus;
  usedBy?: string;
  usedAt?: string;
  expiresAt?: string;
  companyId: string;
}

export interface VoucherBatchSummary {
  batchId: string;
  batchName: string;
  profileName: string;
  total: number;
  unused: number;
  active: number;
  expired: number;
  createdAt: string;
}

// ── Attendance DTOs ───────────────────────────────────────────

export interface AttendanceLog {
  id: string;
  deviceId: string;
  employeeId: string;
  employeeName: string;
  eventType: AttendanceEventType;
  timestamp: string;
  companyId: string;
}

export interface AttendanceReport {
  employeeId: string;
  employeeName: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  totalHours: number | null;
  status: 'present' | 'absent' | 'late' | 'half_day';
}

// ── WebSocket Events ──────────────────────────────────────────

export enum WsEvent {
  // Terminal
  TERMINAL_INIT = 'terminal:init',
  TERMINAL_INPUT = 'terminal:input',
  TERMINAL_OUTPUT = 'terminal:output',
  TERMINAL_CLOSE = 'terminal:close',
  TERMINAL_ERROR = 'terminal:error',

  // Device Status
  DEVICE_STATUS_CHANGE = 'device:status_change',
  DEVICE_STATS_UPDATE = 'device:stats_update',

  // Hotspot
  HOTSPOT_USER_CONNECT = 'hotspot:user_connect',
  HOTSPOT_USER_DISCONNECT = 'hotspot:user_disconnect',
  HOTSPOT_STATS = 'hotspot:stats',

  // Attendance
  ATTENDANCE_NEW_LOG = 'attendance:new_log',

  // System
  SYSTEM_ALERT = 'system:alert',
  SYSTEM_NOTIFICATION = 'system:notification',
}

export interface TerminalSession {
  sessionId: string;
  deviceId: string;
  userId: string;
}

// ── API Response Wrappers ─────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
}

// ── MikroTik Specific ─────────────────────────────────────────

export interface HotspotProfile {
  name: string;
  sessionTimeout: string;
  idleTimeout: string;
  rateLimit: string;
  sharedUsers: number;
}

export interface HotspotActiveUser {
  id: string;
  user: string;
  address: string;
  macAddress: string;
  uptime: string;
  bytesIn: number;
  bytesOut: number;
  server: string;
}

export interface RouterInterface {
  id: string;
  name: string;
  type: string;
  macAddress: string;
  txRate: string;
  rxRate: string;
  running: boolean;
  disabled: boolean;
}

// ── ISP Quota Tracking ────────────────────────────────────────

export type IspAccountStatus = 'active' | 'inactive' | 'error' | 'syncing';

export interface IspQuotaDetails {
  planName?:       string;
  totalGb?:        number;
  usedGb?:         number;
  remainingGb?:    number;
  usagePercent?:   number;
  expiryDate?:     string;
  daysRemaining?:  number;
  accountNumber?:  string;
  subscriberName?: string;
  lineStatus?:     string;
  addons?:         Array<{ name: string; usedGb: number; totalGb: number }>;
}

export interface IspAccount {
  id:            string;
  companyId:     string;
  accountName:   string;
  phoneNumber:   string;
  provider:      string;
  status:        IspAccountStatus;
  lastError:     string | null;
  quotaDetails:  IspQuotaDetails;
  lastSyncedAt:  string | null;
  createdAt:     string;
}

// ── Access Point Command ──────────────────────────────────────

export interface AccessPointCommand {
  deviceId: string;
  command: 'set_ssid' | 'set_password' | 'reboot' | 'get_clients' | 'get_signal';
  params?: Record<string, string>;
}
