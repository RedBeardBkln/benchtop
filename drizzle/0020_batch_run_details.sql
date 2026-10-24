ALTER TABLE "batch_runs" ADD COLUMN "batch_weight_g" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "batch_runs" ADD COLUMN "run_by" uuid;