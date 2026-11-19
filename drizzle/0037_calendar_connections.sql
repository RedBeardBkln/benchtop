CREATE TABLE "calendar_connections" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_email" text,
	"refresh_token_ciphertext" text NOT NULL,
	"scope" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_connections_account_idx" ON "calendar_connections" USING btree ("account_id");--> statement-breakpoint
-- Server-only table (the app connects as the table owner); deny everything to the Supabase API roles
ALTER TABLE "calendar_connections" ENABLE ROW LEVEL SECURITY;
