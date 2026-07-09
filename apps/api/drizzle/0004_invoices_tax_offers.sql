CREATE TABLE IF NOT EXISTS "subscription_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"price" integer NOT NULL,
	"speed" varchar(50),
	"quota" varchar(50),
	"duration_days" integer DEFAULT 30 NOT NULL,
	"is_popular" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "sub_total" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "tax_amount" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_offers" ADD CONSTRAINT "subscription_offers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "offers_company_idx" ON "subscription_offers" ("company_id");
