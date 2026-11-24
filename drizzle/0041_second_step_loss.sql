ALTER TABLE "process_steps" ADD COLUMN "loss2_type" text;--> statement-breakpoint
ALTER TABLE "process_steps" ADD COLUMN "loss2_amount" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "process_steps" ADD COLUMN "loss2_unit" text DEFAULT 'g' NOT NULL;