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
  // ── Data provenance (transparency) ──────────────────────────
  // isMock=true → the numbers are DEMO/placeholder, not live data.
  // The UI must show a "بيانات تجريبية" banner when this is set.
  isMock?:         boolean;
  dataSource?:     'live' | 'mock' | 'manual';
  mockReason?:     string;
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

// ── CPE / AP Remote Command ───────────────────────────────────

export interface CpeCommandDto {
  deviceId: string;
  command: 'set_ssid' | 'set_password' | 'reboot' | 'get_clients' | 'get_signal';
  params: Record<string, string> | undefined;
}

// ============================================================
// MikroTik Enterprise Module - Extended Types
// (Phase A-F) — additive only, nothing above is modified.
// ============================================================

// ── Phase A: Device Information ───────────────────────────────

/** Full /system/resource + identity + routerboard snapshot. */
export interface MikroTikSystemInfo {
  identity: string;
  version: string;
  boardName: string;
  architecture: string;
  uptime: string;
  cpuLoad: number;          // percentage 0-100
  cpuCount: number;
  cpuFrequency: number;     // MHz
  totalMemory: number;      // bytes
  freeMemory: number;       // bytes
  usedMemory: number;       // bytes
  totalHdd: number;         // bytes
  freeHdd: number;          // bytes
  usedHdd: number;          // bytes
  serialNumber: string;
  factoryFirmware?: string;
  currentFirmware?: string;
}

/** A single interface row from /interface/print with traffic counters. */
export interface MikroTikInterfaceDetail {
  id: string;
  name: string;
  type: string;
  running: boolean;
  disabled: boolean;
  comment?: string;
  macAddress?: string;
  mtu?: string;
  rxByte: number;
  txByte: number;
  rxPacket: number;
  txPacket: number;
  rxError: number;
  txError: number;
  rxDrop: number;
  txDrop: number;
}

/** A row from /ip/address/print. */
export interface MikroTikIpAddress {
  id: string;
  address: string;
  network: string;
  interface: string;
  disabled: boolean;
  dynamic: boolean;
  comment?: string;
}

// ── Phase B: Interface Management ─────────────────────────────

export interface InterfaceActionDto {
  deviceId: string;
  /** RouterOS interface name (e.g. "ether1") OR internal .id */
  interface: string;
}

export interface InterfaceCommentDto extends InterfaceActionDto {
  comment: string;
}

// ── Phase C: PPPoE Management ─────────────────────────────────

export interface PppoeUser {
  id: string;
  name: string;
  profile: string;
  service: string;
  callerId?: string;
  rateLimit?: string;
  comment?: string;
  disabled: boolean;
}

export interface PppoeActiveSession {
  id: string;
  name: string;
  service: string;
  callerId: string;
  address: string;
  uptime: string;
  encoding?: string;
  sessionId?: string;
}

export interface CreatePppoeUserDto {
  deviceId: string;
  name: string;
  password: string;
  profile?: string;
  service?: string;       // default "any"
  rateLimit?: string;     // e.g. "10M/2M"
  comment?: string;
  disabled?: boolean;
}

export interface UpdatePppoeUserDto {
  deviceId: string;
  password?: string;
  profile?: string;
  service?: string;
  rateLimit?: string;
  comment?: string;
  disabled?: boolean;
}

// ── Phase D: Hotspot Profiles CRUD ────────────────────────────

export interface CreateHotspotProfileDto {
  deviceId: string;
  name: string;
  sessionTimeout?: string;  // e.g. "1h", "30m"
  idleTimeout?: string;
  rateLimit?: string;       // e.g. "5M/1M"
  sharedUsers?: number;
  comment?: string;
}

export interface UpdateHotspotProfileDto {
  deviceId: string;
  name?: string;
  sessionTimeout?: string;
  idleTimeout?: string;
  rateLimit?: string;
  sharedUsers?: number;
  comment?: string;
}

// ── Phase E: Professional Voucher Generator ───────────────────

export interface GenerateProVouchersDto {
  deviceId: string;
  companyId: string;
  batchName: string;
  profileName: string;
  count: number;                 // 10 | 50 | 100 | 500 | any
  prefix?: string;
  comment?: string;
  /** Use separate username/password instead of identical code. */
  separateCredentials?: boolean;
  /** Length of generated username (when separateCredentials). */
  usernameLength?: number;
  /** Length of generated password. */
  passwordLength?: number;
  /** Validity window pushed to RouterOS as limit-uptime. e.g. "1d", "30d". */
  timeLimit?: string;
  /** Total data cap pushed as limit-bytes-total (in MB). */
  dataLimitMb?: number;
  /** Optional explicit expiration date (ISO) stored in DB. */
  expiresAt?: string;
}

export interface ProVoucherRecord {
  code: string;
  username: string;
  password: string;
  /** Data string suitable for QR-Code rendering on the printed card. */
  qrData: string;
  profileName: string;
  timeLimit?: string;
  dataLimitMb?: number;
  expiresAt?: string;
}

export interface BulkVoucherResult {
  batchId: string;
  batchName: string;
  count: number;
  vouchers: ProVoucherRecord[];
}

// ── Phase F: Monitoring ───────────────────────────────────────

export interface DeviceHealth {
  online: boolean;
  cpuLoad: number;          // percentage
  memoryUsed: number;       // bytes
  memoryTotal: number;      // bytes
  memoryPercent: number;    // 0-100
  uptime: string;
  activePppoe: number;
  activeHotspot: number;
  checkedAt: string;        // ISO timestamp
}

export interface BandwidthSample {
  interface: string;
  rxBitsPerSecond: number;
  txBitsPerSecond: number;
  rxByte: number;
  txByte: number;
  timestamp: string;        // ISO timestamp
}

// ── Phase 4: Realtime Monitoring ──────────────────────────────

/** Combined realtime snapshot broadcast on the /ws/mikrotik namespace. */
export interface MikroTikRealtimeSnapshot {
  deviceId: string;
  online: boolean;
  cpuLoad: number;          // percentage
  memoryUsed: number;       // bytes
  memoryTotal: number;      // bytes
  memoryPercent: number;    // 0-100
  uptime: string;
  activePppoe: number;
  activeHotspot: number;
  rxBitsPerSecond: number;
  txBitsPerSecond: number;
  interface: string;
  timestamp: string;        // ISO timestamp
}

// ── Phase 5: Backup Management ────────────────────────────────

export type MikroTikBackupType = 'binary' | 'export';

export interface MikroTikBackupRecord {
  fileName: string;
  type: MikroTikBackupType;
  sizeBytes: number;
  createdAt: string;        // ISO timestamp
  downloadUrl: string;      // relative API URL to download the file
}

// ── Phase 6: Queue Management ─────────────────────────────────

export interface SimpleQueue {
  id: string;
  name: string;
  target: string;           // e.g. "192.168.88.10/32"
  maxLimit?: string;        // "10M/2M"
  burstLimit?: string;      // "20M/4M"
  burstThreshold?: string;  // "8M/1M"
  burstTime?: string;       // "8s/8s"
  comment?: string;
  disabled: boolean;
}

export interface CreateSimpleQueueDto {
  deviceId: string;
  name: string;
  target: string;
  maxLimit?: string;
  burstLimit?: string;
  burstThreshold?: string;
  burstTime?: string;
  comment?: string;
  disabled?: boolean;
}

export interface UpdateSimpleQueueDto {
  deviceId: string;
  name?: string;
  target?: string;
  maxLimit?: string;
  burstLimit?: string;
  burstThreshold?: string;
  burstTime?: string;
  comment?: string;
  disabled?: boolean;
}
