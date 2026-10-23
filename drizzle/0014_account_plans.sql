ALTER TABLE "accounts" ADD COLUMN "plan" text DEFAULT 'paid' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "free_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "max_users" integer;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "plan" text;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "free_days" integer;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "max_users" integer;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_plan_chk" CHECK ("accounts"."plan" in ('paid', 'free_lifetime', 'free_period'));