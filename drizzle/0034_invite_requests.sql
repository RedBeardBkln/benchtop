CREATE TABLE "invite_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"company" text,
	"role" text,
	"company_type" text,
	"team_size" text,
	"message" text,
	"referral" text,
	"status" text DEFAULT 'new' NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "invite_requests_created_idx" ON "invite_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "invite_requests_email_idx" ON "invite_requests" USING btree ("email");--> statement-breakpoint
-- RLS on with deliberately NO policies (anon/authenticated denied; the app role bypasses it) — see 0007.
ALTER TABLE "invite_requests" ENABLE ROW LEVEL SECURITY;