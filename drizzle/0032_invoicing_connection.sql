CREATE TABLE "invoicing_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"key_hash" text NOT NULL,
	"key_last4" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "billed_ref" text;--> statement-breakpoint
ALTER TABLE "invoicing_connections" ADD CONSTRAINT "invoicing_connections_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoicing_connections_key_hash_uq" ON "invoicing_connections" USING btree ("key_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "invoicing_connections_one_live_uq" ON "invoicing_connections" USING btree ("user_id") WHERE "invoicing_connections"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "invoicing_connections_account_idx" ON "invoicing_connections" USING btree ("account_id");--> statement-breakpoint
-- RLS on with deliberately NO policies (anon/authenticated denied; the app role bypasses it) — see 0007.
ALTER TABLE "invoicing_connections" ENABLE ROW LEVEL SECURITY;
