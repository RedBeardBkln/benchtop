ALTER TABLE "formulation_lines" ADD COLUMN "pct_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "formulations" ADD COLUMN "batch_locked" boolean DEFAULT false NOT NULL;