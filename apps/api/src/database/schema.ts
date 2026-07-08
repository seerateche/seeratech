// ============================================================
// SIRA PLATFORM v4 - Complete Drizzle ORM Schema
// ============================================================
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  serial,
  bigint,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ── Enums ─────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', [
  'super_admin',
  'company_admin',
  'viewer',
]);

export const deviceTypeEnum = pgEnum('device_type', [
  'mikrotik',
  'dvr',
  'nvr',
  'biometric',
  'access_point',
]);

export const deviceStatusEnum = pgEnum('device_status', [
  'online',
  'offline',
  'connecting',
  'error',
]);

export const voucherStatusEnum = pgEnum('voucher_status', [
  'unused',
  'active',
  'expired',
  'disabled',
]);

export const companyStatusEnum = pgEnum('company_status', [
  'active',
  'suspended',
  'trial',
]);

export const attendanceEventEnum = pgEnum('attendance_event_type', [
  'check_in',
  'check_out',
  'break_in',
  'break_out',
  'overtime_in',
  'overtime_out',
]);

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'unpaid',
  'paid',
  'overdue',
  'cancelled',
]);

export const quotationStatusEnum = pgEnum('quotation_status', [
  'draft',
  'sent',
  'accepted',
  'rejected',
]);

export const transactionTypeEnum = pgEnum('transaction_type', [
  'income',
  'expense',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'cash',
  'bank_transfer',
  'vodafone_cash',
  'credit',
]);

// ── Companies (Multi-tenant root) ─────────────────────────────

export const companies = pgTable(
  'companies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    status: companyStatusEnum('status').notNull().default('trial'),
    country: varchar('country', { length: 100 }).notNull(),
    city: varchar('city', { length: 100 }).notNull(),
    contactEmail: varchar('contact_email', { length: 255 }).notNull(),
    contactPhone: varchar('contact_phone', { length: 50 }),
    logoUrl: text('logo_url'),
    maxDevices: integer('max_devices').notNull().default(10),
    maxVouchers: integer('max_vouchers').notNull().default(1000),
    // VPN / WireGuard config for this tenant
    vpnSubnet: varchar('vpn_subnet', { length: 50 }),
    vpnPublicKey: text('vpn_public_key'),
    // Billing
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    subscriptionEndsAt: timestamp('subscription_ends_at', { withTimezone: true }),
    // Metadata
    settings: jsonb('settings').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex('companies_slug_idx').on(t.slug),
    statusIdx: index('companies_status_idx').on(t.status),
  }),
);

// ── Users ─────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').references(() => companies.id, {
      onDelete: 'cascade',
    }),
    email: varchar('email', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').notNull().default('viewer'),
    avatarUrl: text('avatar_url'),
    isActive: boolean('is_active').notNull().default(true),
    // 2FA
    totpSecret: text('totp_secret'),
    totpEnabled: boolean('totp_enabled').notNull().default(false),
    // Security
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    lastLoginIp: varchar('last_login_ip', { length: 50 }),
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    refreshTokenHash: text('refresh_token_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
    companyIdx: index('users_company_idx').on(t.companyId),
    roleIdx: index('users_role_idx').on(t.role),
  }),
);

// ── Devices ───────────────────────────────────────────────────

export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    type: deviceTypeEnum('type').notNull(),
    status: deviceStatusEnum('status').notNull().default('offline'),
    // Connection info
    host: varchar('host', { length: 255 }).notNull(),
    port: integer('port').notNull(),
    apiPort: integer('api_port'),
    // Credentials stored AES-256-GCM encrypted
    encryptedUsername: text('encrypted_username').notNull(),
    encryptedPassword: text('encrypted_password').notNull(),
    credentialIv: varchar('credential_iv', { length: 64 }).notNull(),
    credentialTag: varchar('credential_tag', { length: 64 }).notNull(),
    // VPN tunnel
    useVpn: boolean('use_vpn').notNull().default(false),
    vpnIp: varchar('vpn_ip', { length: 50 }),
    vpnPublicKey: text('vpn_public_key'),
    vpnPresharedKey: text('vpn_preshared_key'),
    // Device metadata
    description: text('description'),
    location: varchar('location', { length: 255 }),
    serialNumber: varchar('serial_number', { length: 100 }),
    firmwareVersion: varchar('firmware_version', { length: 50 }),
    // Stats snapshot
    lastStats: jsonb('last_stats').default({}),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    // Config
    syncInterval: integer('sync_interval').notNull().default(60), // seconds
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyIdx: index('devices_company_idx').on(t.companyId),
    typeIdx: index('devices_type_idx').on(t.type),
    statusIdx: index('devices_status_idx').on(t.status),
  }),
);

// ── Voucher Batches ───────────────────────────────────────────

export const voucherBatches = pgTable(
  'voucher_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    profileName: varchar('profile_name', { length: 100 }).notNull(),
    totalCount: integer('total_count').notNull(),
    pushedToDevice: boolean('pushed_to_device').notNull().default(false),
    pushedAt: timestamp('pushed_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyIdx: index('voucher_batches_company_idx').on(t.companyId),
    deviceIdx: index('voucher_batches_device_idx').on(t.deviceId),
  }),
);

// ── Vouchers (Hotspot Cards) ──────────────────────────────────

export const vouchers = pgTable(
  'vouchers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => voucherBatches.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 64 }).notNull(),
    profileName: varchar('profile_name', { length: 100 }).notNull(),
    status: voucherStatusEnum('status').notNull().default('unused'),
    // Usage data synced from MikroTik
    usedBy: varchar('used_by', { length: 100 }),
    usedByMac: varchar('used_by_mac', { length: 50 }),
    usedByIp: varchar('used_by_ip', { length: 50 }),
    usedAt: timestamp('used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    // Limits
    comment: text('comment'),
    bytesIn: bigint('bytes_in', { mode: 'number' }).default(0),
    bytesOut: bigint('bytes_out', { mode: 'number' }).default(0),
    uptime: varchar('uptime', { length: 50 }),
    // RouterOS internal ID for sync
    routerosId: varchar('routeros_id', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeIdx: index('vouchers_code_idx').on(t.code),
    batchIdx: index('vouchers_batch_idx').on(t.batchId),
    companyIdx: index('vouchers_company_idx').on(t.companyId),
    statusIdx: index('vouchers_status_idx').on(t.status),
    deviceCodeIdx: uniqueIndex('vouchers_device_code_idx').on(t.deviceId, t.code),
  }),
);

// ── Attendance Employees ──────────────────────────────────────

export const employees = pgTable(
  'employees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    zkEmployeeId: integer('zk_employee_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    department: varchar('department', { length: 100 }),
    position: varchar('position', { length: 100 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyIdx: index('employees_company_idx').on(t.companyId),
    zkIdIdx: index('employees_zk_id_idx').on(t.zkEmployeeId),
  }),
);

// ── Attendance Logs ───────────────────────────────────────────

export const attendanceLogs = pgTable(
  'attendance_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id').references(() => employees.id),
    zkEmployeeId: integer('zk_employee_id').notNull(),
    employeeName: varchar('employee_name', { length: 255 }),
    eventType: attendanceEventEnum('event_type').notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    // Verification details from ZKTeco
    verifyType: integer('verify_type').default(0), // 0=fingerprint, 1=password, 2=card
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyIdx: index('attendance_logs_company_idx').on(t.companyId),
    deviceIdx: index('attendance_logs_device_idx').on(t.deviceId),
    employeeIdx: index('attendance_logs_employee_idx').on(t.employeeId),
    timestampIdx: index('attendance_logs_timestamp_idx').on(t.timestamp),
    // Prevent duplicate records
    uniqueLogIdx: uniqueIndex('attendance_logs_unique_idx').on(
      t.deviceId,
      t.zkEmployeeId,
      t.timestamp,
    ),
  }),
);

// ── Terminal Sessions Audit Log ───────────────────────────────

export const terminalSessions = pgTable(
  'terminal_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id').references(() => companies.id),
    sessionToken: varchar('session_token', { length: 128 }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    commandLog: text('command_log'), // compressed audit trail
    ipAddress: varchar('ip_address', { length: 50 }),
    userAgent: text('user_agent'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => ({
    userIdx: index('terminal_sessions_user_idx').on(t.userId),
    deviceIdx: index('terminal_sessions_device_idx').on(t.deviceId),
    tokenIdx: uniqueIndex('terminal_sessions_token_idx').on(t.sessionToken),
  }),
);

// ── Hotspot Templates ─────────────────────────────────────────

export const hotspotTemplates = pgTable(
  'hotspot_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    originalFilename: varchar('original_filename', { length: 255 }),
    storagePath: text('storage_path').notNull(),
    isActive: boolean('is_active').notNull().default(false),
    uploadedBy: uuid('uploaded_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

// ── Audit Logs ────────────────────────────────────────────────

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    companyId: uuid('company_id').references(() => companies.id),
    userId: uuid('user_id').references(() => users.id),
    action: varchar('action', { length: 100 }).notNull(),
    resource: varchar('resource', { length: 100 }).notNull(),
    resourceId: varchar('resource_id', { length: 100 }),
    details: jsonb('details').default({}),
    ipAddress: varchar('ip_address', { length: 50 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyIdx: index('audit_logs_company_idx').on(t.companyId),
    userIdx: index('audit_logs_user_idx').on(t.userId),
    actionIdx: index('audit_logs_action_idx').on(t.action),
    createdAtIdx: index('audit_logs_created_at_idx').on(t.createdAt),
  }),
);

// ── Relations ─────────────────────────────────────────────────

export const companyRelations = relations(companies, ({ many }) => ({
  users: many(users),
  devices: many(devices),
  voucherBatches: many(voucherBatches),
  vouchers: many(vouchers),
  attendanceLogs: many(attendanceLogs),
  employees: many(employees),
  terminalSessions: many(terminalSessions),
  hotspotTemplates: many(hotspotTemplates),
  ispAccounts: many(ispAccounts),
}));

export const userRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  terminalSessions: many(terminalSessions),
}));

export const deviceRelations = relations(devices, ({ one, many }) => ({
  company: one(companies, {
    fields: [devices.companyId],
    references: [companies.id],
  }),
  voucherBatches: many(voucherBatches),
  vouchers: many(vouchers),
  attendanceLogs: many(attendanceLogs),
}));

export const voucherBatchRelations = relations(voucherBatches, ({ one, many }) => ({
  company: one(companies, {
    fields: [voucherBatches.companyId],
    references: [companies.id],
  }),
  device: one(devices, {
    fields: [voucherBatches.deviceId],
    references: [devices.id],
  }),
  createdByUser: one(users, {
    fields: [voucherBatches.createdBy],
    references: [users.id],
  }),
  vouchers: many(vouchers),
}));

export const voucherRelations = relations(vouchers, ({ one }) => ({
  batch: one(voucherBatches, {
    fields: [vouchers.batchId],
    references: [voucherBatches.id],
  }),
  company: one(companies, {
    fields: [vouchers.companyId],
    references: [companies.id],
  }),
  device: one(devices, {
    fields: [vouchers.deviceId],
    references: [devices.id],
  }),
}));

export const attendanceLogRelations = relations(attendanceLogs, ({ one }) => ({
  company: one(companies, {
    fields: [attendanceLogs.companyId],
    references: [companies.id],
  }),
  device: one(devices, {
    fields: [attendanceLogs.deviceId],
    references: [devices.id],
  }),
  employee: one(employees, {
    fields: [attendanceLogs.employeeId],
    references: [employees.id],
  }),
}));

// ── ISP Accounts (WE Telecom Quota Tracking) ─────────────────

export const ispAccountStatusEnum = pgEnum('isp_account_status', [
  'active',
  'inactive',
  'error',
  'syncing',
]);

export const ispAccounts = pgTable(
  'isp_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    // Human-readable label e.g. "كافيه العمدة - خط 1"
    accountName: varchar('account_name', { length: 255 }).notNull(),
    // Landline number format: 035xxxxxxx
    phoneNumber: varchar('phone_number', { length: 20 }).notNull(),
    // AES-256-GCM encrypted — format: "iv:ciphertext"
    encryptedPassword: text('encrypted_password').notNull(),
    // Stores iv+tag for decryption
    credentialIv:  varchar('credential_iv',  { length: 64 }).notNull(),
    credentialTag: varchar('credential_tag', { length: 64 }).notNull(),
    // ISP provider — extensible for future providers
    provider: varchar('provider', { length: 50 }).notNull().default('we_telecom'),
    status: ispAccountStatusEnum('status').notNull().default('active'),
    // Last error message (Arabic) if sync failed
    lastError: text('last_error'),
    // JSONB blob — structure defined in IspQuotaDetails interface
    quotaDetails: jsonb('quota_details').$type<IspQuotaDetails>().default({}),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    // Auth session cache (short-lived WE token stored encrypted)
    encryptedSessionToken: text('encrypted_session_token'),
    sessionTokenExpiresAt: timestamp('session_token_expires_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyIdx:  index('isp_accounts_company_idx').on(t.companyId),
    providerIdx: index('isp_accounts_provider_idx').on(t.provider),
    // A phone number is unique per company
    phoneCompanyIdx: uniqueIndex('isp_accounts_phone_company_idx').on(
      t.companyId,
      t.phoneNumber,
    ),
  }),
);

// TypeScript shape of the quotaDetails JSONB column
export interface IspQuotaDetails {
  planName?:       string;   // e.g. "Super Speed 1 - 250GB"
  totalGb?:        number;   // e.g. 250
  usedGb?:         number;   // e.g. 182.4
  remainingGb?:    number;   // e.g. 67.6
  usagePercent?:   number;   // 0-100
  expiryDate?:     string;   // ISO date string
  daysRemaining?:  number;
  accountNumber?:  string;   // WE account ID
  subscriberName?: string;
  lineStatus?:     string;   // 'Active' | 'Suspended' etc.
  addons?:         Array<{   // Extra bundles
    name:    string;
    usedGb:  number;
    totalGb: number;
  }>;
  rawResponse?:    unknown;  // Raw API blob for debugging
}

// ── ISP Account Relations ─────────────────────────────────────

export const ispAccountRelations = relations(ispAccounts, ({ one }) => ({
  company: one(companies, {
    fields: [ispAccounts.companyId],
    references: [companies.id],
  }),
  createdByUser: one(users, {
    fields: [ispAccounts.createdBy],
    references: [users.id],
  }),
}));

// Add to company relations (append via separate relations call)
// ── Type Exports ──────────────────────────────────────────────

export type IspAccount    = typeof ispAccounts.$inferSelect;
export type NewIspAccount = typeof ispAccounts.$inferInsert;

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type VoucherBatch = typeof voucherBatches.$inferSelect;
export type NewVoucherBatch = typeof voucherBatches.$inferInsert;
export type Voucher = typeof vouchers.$inferSelect;
export type NewVoucher = typeof vouchers.$inferInsert;
export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
export type AttendanceLog = typeof attendanceLogs.$inferSelect;
export type NewAttendanceLog = typeof attendanceLogs.$inferInsert;
export type TerminalSession = typeof terminalSessions.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

// ── Billing & Accounting ─────────────────────────────────────

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
    customerId: uuid('customer_id'), // Can reference users/subscribers if needed
    customerName: varchar('customer_name', { length: 255 }).notNull(),
    customerPhone: varchar('customer_phone', { length: 50 }),
    amount: integer('amount').notNull(), // stored in cents/piasters or just integer
    status: invoiceStatusEnum('status').notNull().default('unpaid'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyIdx: index('invoices_company_idx').on(t.companyId),
    statusIdx: index('invoices_status_idx').on(t.status),
  })
);

export const quotations = pgTable(
  'quotations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    quotationNumber: varchar('quotation_number', { length: 50 }).notNull(),
    customerName: varchar('customer_name', { length: 255 }).notNull(),
    customerPhone: varchar('customer_phone', { length: 50 }),
    totalAmount: integer('total_amount').notNull(),
    status: quotationStatusEnum('status').notNull().default('draft'),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    items: jsonb('items').notNull().default('[]'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyIdx: index('quotations_company_idx').on(t.companyId),
  })
);

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    category: varchar('category', { length: 100 }).notNull(),
    amount: integer('amount').notNull(),
    description: text('description').notNull(),
    expenseDate: timestamp('expense_date', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyIdx: index('expenses_company_idx').on(t.companyId),
    dateIdx: index('expenses_date_idx').on(t.expenseDate),
  })
);

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    type: transactionTypeEnum('type').notNull(),
    amount: integer('amount').notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull().default('cash'),
    referenceId: uuid('reference_id'), // Can refer to Invoice ID or Expense ID
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyIdx: index('transactions_company_idx').on(t.companyId),
  })
);

export const vodafoneCashTransfers = pgTable(
  'vodafone_cash_transfers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    walletNumber: varchar('wallet_number', { length: 50 }).notNull(),
    senderNumber: varchar('sender_number', { length: 50 }),
    amount: integer('amount').notNull(),
    referenceId: uuid('reference_id'), // E.g., Invoice ID
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyIdx: index('vfcash_company_idx').on(t.companyId),
  })
);

// ── Billing Relations ────────────────────────────────────────

export const invoiceRelations = relations(invoices, ({ one }) => ({
  company: one(companies, {
    fields: [invoices.companyId],
    references: [companies.id],
  }),
}));

export const quotationRelations = relations(quotations, ({ one }) => ({
  company: one(companies, {
    fields: [quotations.companyId],
    references: [companies.id],
  }),
}));

export const expenseRelations = relations(expenses, ({ one }) => ({
  company: one(companies, {
    fields: [expenses.companyId],
    references: [companies.id],
  }),
}));

export const transactionRelations = relations(transactions, ({ one }) => ({
  company: one(companies, {
    fields: [transactions.companyId],
    references: [companies.id],
  }),
}));

export const vodafoneCashRelations = relations(vodafoneCashTransfers, ({ one }) => ({
  company: one(companies, {
    fields: [vodafoneCashTransfers.companyId],
    references: [companies.id],
  }),
}));

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type Quotation = typeof quotations.$inferSelect;
export type NewQuotation = typeof quotations.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type VodafoneCashTransfer = typeof vodafoneCashTransfers.$inferSelect;
export type NewVodafoneCashTransfer = typeof vodafoneCashTransfers.$inferInsert;
