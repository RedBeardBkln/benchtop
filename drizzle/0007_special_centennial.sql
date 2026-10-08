-- Row level security is enabled on every new table at creation time, with deliberately NO policies:
-- anon/authenticated (public Supabase key) are denied everything. The app connects with a privileged
-- role (table owner / BYPASSRLS) and is unaffected. supabase/migrations/004_outside_users_rls.sql
-- repeats these statements (idempotent) for environments that apply it separately.
CREATE TABLE "account_members" (
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_members_account_id_user_id_pk" PRIMARY KEY("account_id","user_id"),
	CONSTRAINT "account_members_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "account_members_role_chk" CHECK ("account_members"."role" in ('owner', 'member'))
);
--> statement-breakpoint
ALTER TABLE "account_members" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"billing_exempt" boolean DEFAULT false NOT NULL,
	"stripe_customer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "accounts_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"note" text,
	"invited_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by" uuid,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"full_name" text,
	"company" text,
	"job_title" text,
	"phone" text,
	"timezone" text,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"terms_version" text,
	"terms_accepted_at" timestamp with time zone,
	"privacy_version" text,
	"privacy_accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stripe_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"stripe_subscription_id" text,
	"status" text NOT NULL,
	"price_id" text,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"last_event_created" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Pre-existing data (ALP Bio / LaunchTime staff) becomes the first, billing-exempt account.
-- Fixed UUID so application code and the bootstrap script can refer to it.
INSERT INTO "accounts" ("id", "name", "billing_exempt") VALUES ('00000000-0000-4000-8000-000000000001', 'ALP Bio', true) ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- Add account_id as NULLABLE first so the migration works on tables that already contain rows.
ALTER TABLE "ingredients" ADD COLUMN "account_id" uuid;
--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "account_id" uuid;
--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "account_id" uuid;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "account_id" uuid;
--> statement-breakpoint
ALTER TABLE "formulations" ADD COLUMN "account_id" uuid;
--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "account_id" uuid;
--> statement-breakpoint
-- Backfill every pre-existing row into the legacy account.
UPDATE "ingredients" SET "account_id" = '00000000-0000-4000-8000-000000000001' WHERE "account_id" IS NULL;
--> statement-breakpoint
UPDATE "suppliers" SET "account_id" = '00000000-0000-4000-8000-000000000001' WHERE "account_id" IS NULL;
--> statement-breakpoint
UPDATE "equipment" SET "account_id" = '00000000-0000-4000-8000-000000000001' WHERE "account_id" IS NULL;
--> statement-breakpoint
UPDATE "projects" SET "account_id" = '00000000-0000-4000-8000-000000000001' WHERE "account_id" IS NULL;
--> statement-breakpoint
UPDATE "formulations" SET "account_id" = '00000000-0000-4000-8000-000000000001' WHERE "account_id" IS NULL;
--> statement-breakpoint
UPDATE "audit_log" SET "account_id" = '00000000-0000-4000-8000-000000000001' WHERE "account_id" IS NULL;
--> statement-breakpoint
-- Only now enforce NOT NULL. Deliberately NO default: a forgotten code path must fail loudly rather than
-- silently write into the legacy account.
ALTER TABLE "ingredients" ALTER COLUMN "account_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "account_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "equipment" ALTER COLUMN "account_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "account_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "formulations" ALTER COLUMN "account_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "account_id" SET NOT NULL;
--> statement-breakpoint
DROP INDEX "equipment_name_lower_uq";
--> statement-breakpoint
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "account_members_account_idx" ON "account_members" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("email");
--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "formulations" ADD CONSTRAINT "formulations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "ingredients_account_idx" ON "ingredients" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX "suppliers_account_idx" ON "suppliers" USING btree ("account_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_account_name_lower_uq" ON "equipment" USING btree ("account_id",lower("name"));
--> statement-breakpoint
CREATE INDEX "projects_account_idx" ON "projects" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX "formulations_account_idx" ON "formulations" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX "audit_log_account_idx" ON "audit_log" USING btree ("account_id");
