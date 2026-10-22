CREATE TABLE "client_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"email" text,
	"phone" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"notes" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"notes" text,
	"legal_name" text,
	"tax_id" text,
	"payment_terms" text,
	"currency" text,
	"po_required" boolean DEFAULT false NOT NULL,
	"billing_email" text,
	"billing_address" jsonb,
	"accounting_notes" text,
	"shipping_address" jsonb,
	"ups_account" text,
	"fedex_account" text,
	"dhl_account" text,
	"other_carrier_accounts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_carrier" text,
	"shipping_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "client_id" uuid;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_contacts_client_idx" ON "client_contacts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "clients_account_idx" ON "clients" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_account_name_uq" ON "clients" USING btree ("account_id",lower("name"));--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_client_idx" ON "projects" USING btree ("client_id");--> statement-breakpoint
-- Every client name already typed on a project becomes a client record (one per name, case-insensitive)
INSERT INTO "clients" ("account_id", "name")
SELECT "account_id", min(trim("client"))
FROM "projects"
WHERE "client" IS NOT NULL AND trim("client") <> ''
GROUP BY "account_id", lower(trim("client"));--> statement-breakpoint
UPDATE "projects" p
SET "client_id" = c."id", "client" = c."name"
FROM "clients" c
WHERE c."account_id" = p."account_id" AND p."client" IS NOT NULL AND lower(c."name") = lower(trim(p."client"));--> statement-breakpoint
UPDATE "projects" SET "client" = NULL WHERE "client" IS NOT NULL AND trim("client") = '';
