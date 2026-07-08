DO $$ BEGIN
 CREATE TYPE "invoice_status" AS ENUM('unpaid', 'paid', 'overdue', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "quotation_status" AS ENUM('draft', 'sent', 'accepted', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "transaction_type" AS ENUM('income', 'expense');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "payment_method" AS ENUM('cash', 'bank_transfer', 'vodafone_cash', 'credit');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"category" varchar(100) NOT NULL,
	"amount" integer NOT NULL,
	"description" text NOT NULL,
	"expense_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"customer_id" uuid,
	"customer_name" varchar(255) NOT NULL,
	"customer_phone" varchar(50),
	"amount" integer NOT NULL,
	"status" "invoice_status" DEFAULT 'unpaid' NOT NULL,
	"due_date" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"quotation_number" varchar(50) NOT NULL,
	"customer_name" varchar(255) NOT NULL,
	"customer_phone" varchar(50),
	"total_amount" integer NOT NULL,
	"status" "quotation_status" DEFAULT 'draft' NOT NULL,
	"valid_until" timestamp with time zone,
	"items" jsonb DEFAULT '[]' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"type" "transaction_type" NOT NULL,
	"amount" integer NOT NULL,
	"payment_method" "payment_method" DEFAULT 'cash' NOT NULL,
	"reference_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vodafone_cash_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"wallet_number" varchar(50) NOT NULL,
	"sender_number" varchar(50),
	"amount" integer NOT NULL,
	"reference_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_company_idx" ON "expenses" ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_date_idx" ON "expenses" ("expense_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_company_idx" ON "invoices" ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotations_company_idx" ON "quotations" ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_company_idx" ON "transactions" ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vfcash_company_idx" ON "vodafone_cash_transfers" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotations" ADD CONSTRAINT "quotations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vodafone_cash_transfers" ADD CONSTRAINT "vodafone_cash_transfers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
