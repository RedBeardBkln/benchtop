ALTER TABLE "account_members" DROP CONSTRAINT "account_members_role_chk";--> statement-breakpoint
ALTER TABLE "account_members" ADD COLUMN "access" jsonb;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "access" jsonb;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "seat_quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invitations_account_idx" ON "invitations" USING btree ("account_id");--> statement-breakpoint
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_role_chk" CHECK ("account_members"."role" in ('owner', 'admin', 'member'));--> statement-breakpoint
-- Members that existed before team permissions had full access; keep it that way.
UPDATE "account_members" SET "access" = '{"library":"edit","allProjects":"edit","clients":[],"projects":[]}'::jsonb WHERE "role" = 'member' AND "access" IS NULL;
