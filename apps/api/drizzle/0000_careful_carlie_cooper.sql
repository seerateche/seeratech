DO $$ BEGIN
 CREATE TYPE "attendance_event_type" AS ENUM('check_in', 'check_out', 'break_in', 'break_out', 'overtime_in', 'overtime_out');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "company_status" AS ENUM('active', 'suspended', 'trial');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "device_status" AS ENUM('online', 'offline', 'connecting', 'error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "device_type" AS ENUM('mikrotik', 'dvr', 'nvr', 'biometric', 'access_point');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "isp_account_status" AS ENUM('active', 'inactive', 'error', 'syncing');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "user_role" AS ENUM('super_admin', 'company_admin', 'viewer');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "voucher_status" AS ENUM('unused', 'active', 'expired', 'disabled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attendance_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"employee_id" uuid,
	"zk_employee_id" integer NOT NULL,
	"employee_name" varchar(255),
	"event_type" "attendance_event_type" NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"verify_type" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" uuid,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"resource" varchar(100) NOT NULL,
	"resource_id" varchar(100),
	"details" jsonb DEFAULT '{}'::jsonb,
	"ip_address" varchar(50),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"status" "company_status" DEFAULT 'trial' NOT NULL,
	"country" varchar(100) NOT NULL,
	"city" varchar(100) NOT NULL,
	"contact_email" varchar(255) NOT NULL,
	"contact_phone" varchar(50),
	"logo_url" text,
	"max_devices" integer DEFAULT 10 NOT NULL,
	"max_vouchers" integer DEFAULT 1000 NOT NULL,
	"vpn_subnet" varchar(50),
	"vpn_public_key" text,
	"trial_ends_at" timestamp with time zone,
	"subscription_ends_at" timestamp with time zone,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "device_type" NOT NULL,
	"status" "device_status" DEFAULT 'offline' NOT NULL,
	"host" varchar(255) NOT NULL,
	"port" integer NOT NULL,
	"api_port" integer,
	"encrypted_username" text NOT NULL,
	"encrypted_password" text NOT NULL,
	"credential_iv" varchar(64) NOT NULL,
	"credential_tag" varchar(64) NOT NULL,
	"use_vpn" boolean DEFAULT false NOT NULL,
	"vpn_ip" varchar(50),
	"vpn_public_key" text,
	"vpn_preshared_key" text,
	"description" text,
	"location" varchar(255),
	"serial_number" varchar(100),
	"firmware_version" varchar(50),
	"last_stats" jsonb DEFAULT '{}'::jsonb,
	"last_seen_at" timestamp with time zone,
	"last_sync_at" timestamp with time zone,
	"sync_interval" integer DEFAULT 60 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"zk_employee_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"department" varchar(100),
	"position" varchar(100),
	"email" varchar(255),
	"phone" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hotspot_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"original_filename" varchar(255),
	"storage_path" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "isp_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"account_name" varchar(255) NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"encrypted_password" text NOT NULL,
	"credential_iv" varchar(64) NOT NULL,
	"credential_tag" varchar(64) NOT NULL,
	"provider" varchar(50) DEFAULT 'we_telecom' NOT NULL,
	"status" "isp_account_status" DEFAULT 'active' NOT NULL,
	"last_error" text,
	"quota_details" jsonb DEFAULT '{}'::jsonb,
	"last_synced_at" timestamp with time zone,
	"encrypted_session_token" text,
	"session_token_expires_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "terminal_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"company_id" uuid,
	"session_token" varchar(128) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"command_log" text,
	"ip_address" varchar(50),
	"user_agent" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"avatar_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"totp_secret" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"last_login_ip" varchar(50),
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"refresh_token_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "voucher_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"profile_name" varchar(100) NOT NULL,
	"total_count" integer NOT NULL,
	"pushed_to_device" boolean DEFAULT false NOT NULL,
	"pushed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"profile_name" varchar(100) NOT NULL,
	"status" "voucher_status" DEFAULT 'unused' NOT NULL,
	"used_by" varchar(100),
	"used_by_mac" varchar(50),
	"used_by_ip" varchar(50),
	"used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"comment" text,
	"bytes_in" bigint DEFAULT 0,
	"bytes_out" bigint DEFAULT 0,
	"uptime" varchar(50),
	"routeros_id" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_logs_company_idx" ON "attendance_logs" ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_logs_device_idx" ON "attendance_logs" ("device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_logs_employee_idx" ON "attendance_logs" ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_logs_timestamp_idx" ON "attendance_logs" ("timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_logs_unique_idx" ON "attendance_logs" ("device_id","zk_employee_id","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_company_idx" ON "audit_logs" ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_user_idx" ON "audit_logs" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "companies_slug_idx" ON "companies" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "companies_status_idx" ON "companies" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "devices_company_idx" ON "devices" ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "devices_type_idx" ON "devices" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "devices_status_idx" ON "devices" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employees_company_idx" ON "employees" ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employees_zk_id_idx" ON "employees" ("zk_employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "isp_accounts_company_idx" ON "isp_accounts" ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "isp_accounts_provider_idx" ON "isp_accounts" ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "isp_accounts_phone_company_idx" ON "isp_accounts" ("company_id","phone_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "terminal_sessions_user_idx" ON "terminal_sessions" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "terminal_sessions_device_idx" ON "terminal_sessions" ("device_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "terminal_sessions_token_idx" ON "terminal_sessions" ("session_token");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_company_idx" ON "users" ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" ("role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voucher_batches_company_idx" ON "voucher_batches" ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voucher_batches_device_idx" ON "voucher_batches" ("device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vouchers_code_idx" ON "vouchers" ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vouchers_batch_idx" ON "vouchers" ("batch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vouchers_company_idx" ON "vouchers" ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vouchers_status_idx" ON "vouchers" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vouchers_device_code_idx" ON "vouchers" ("device_id","code");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "devices" ADD CONSTRAINT "devices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hotspot_templates" ADD CONSTRAINT "hotspot_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hotspot_templates" ADD CONSTRAINT "hotspot_templates_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "isp_accounts" ADD CONSTRAINT "isp_accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "isp_accounts" ADD CONSTRAINT "isp_accounts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "terminal_sessions" ADD CONSTRAINT "terminal_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "terminal_sessions" ADD CONSTRAINT "terminal_sessions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "terminal_sessions" ADD CONSTRAINT "terminal_sessions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "voucher_batches" ADD CONSTRAINT "voucher_batches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "voucher_batches" ADD CONSTRAINT "voucher_batches_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "voucher_batches" ADD CONSTRAINT "voucher_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_batch_id_voucher_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "voucher_batches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
