ALTER TABLE "sous_chef_proposals" DROP CONSTRAINT "sous_chef_proposals_status_chk";--> statement-breakpoint
ALTER TABLE "sous_chef_proposals" ADD COLUMN "snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "sous_chef_proposals" ADD COLUMN "applied_fingerprint" text;--> statement-breakpoint
ALTER TABLE "sous_chef_proposals" ADD COLUMN "reverted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sous_chef_proposals" ADD CONSTRAINT "sous_chef_proposals_status_chk" CHECK ("sous_chef_proposals"."status" in ('pending', 'applied', 'declined', 'stale', 'reverted'));