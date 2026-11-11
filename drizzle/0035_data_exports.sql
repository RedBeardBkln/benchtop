CREATE TABLE "data_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"choices" jsonb,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"bytes" bigint,
	"duration_ms" integer,
	"error" text,
	"staged_path" text,
	"downloaded_at" timestamp with time zone,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "data_exports_kind_chk" CHECK ("data_exports"."kind" in ('files', 'json')),
	CONSTRAINT "data_exports_status_chk" CHECK ("data_exports"."status" in ('started', 'succeeded', 'failed'))
);
--> statement-breakpoint
CREATE INDEX "data_exports_account_at_idx" ON "data_exports" USING btree ("account_id","at");--> statement-breakpoint
CREATE INDEX "data_exports_at_idx" ON "data_exports" USING btree ("at");--> statement-breakpoint
-- RLS on with deliberately NO policies (anon/authenticated denied; the app role bypasses it) — see 0007.
ALTER TABLE "data_exports" ENABLE ROW LEVEL SECURITY;
