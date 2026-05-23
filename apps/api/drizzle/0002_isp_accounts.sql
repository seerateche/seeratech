-- ============================================================
-- Migration 0002: ISP Accounts (WE Telecom Quota Tracking)
-- Run: psql $DATABASE_URL -f drizzle/0002_isp_accounts.sql
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "public"."isp_account_status" AS ENUM(
    'active', 'inactive', 'error', 'syncing'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "isp_accounts" (
  "id"                      uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id"              uuid NOT NULL,
  "account_name"            varchar(255) NOT NULL,
  "phone_number"            varchar(20) NOT NULL,
  "encrypted_password"      text NOT NULL,
  "credential_iv"           varchar(64) NOT NULL,
  "credential_tag"          varchar(64) NOT NULL,
  "provider"                varchar(50) NOT NULL DEFAULT 'we_telecom',
  "status"                  "isp_account_status" NOT NULL DEFAULT 'active',
  "last_error"              text,
  "quota_details"           jsonb DEFAULT '{}',
  "last_synced_at"          timestamp with time zone,
  "encrypted_session_token" text,
  "session_token_expires_at" timestamp with time zone,
  "created_by"              uuid,
  "created_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"              timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "isp_accounts_company_id_fk"
    FOREIGN KEY ("company_id")
    REFERENCES "companies"("id") ON DELETE cascade,
  CONSTRAINT "isp_accounts_created_by_fk"
    FOREIGN KEY ("created_by")
    REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "isp_accounts_company_idx"
  ON "isp_accounts" ("company_id");

CREATE INDEX IF NOT EXISTS "isp_accounts_provider_idx"
  ON "isp_accounts" ("provider");

CREATE UNIQUE INDEX IF NOT EXISTS "isp_accounts_phone_company_idx"
  ON "isp_accounts" ("company_id", "phone_number");

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_isp_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS isp_accounts_updated_at ON isp_accounts;
CREATE TRIGGER isp_accounts_updated_at
  BEFORE UPDATE ON isp_accounts
  FOR EACH ROW EXECUTE PROCEDURE update_isp_accounts_updated_at();
