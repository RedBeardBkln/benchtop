ALTER TABLE "process_steps" ADD COLUMN "loss_type" text;--> statement-breakpoint
ALTER TABLE "process_steps" ADD COLUMN "loss_amount" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "process_steps" ADD COLUMN "loss_unit" text DEFAULT 'g' NOT NULL;--> statement-breakpoint
-- Yield is now derived from per-step loss. Carry each formulation's old yield % forward as a moisture loss
-- on its final step (or on a new step when it has none) so existing nutrient profiles don't change.
UPDATE "process_steps" ps
SET "loss_type" = 'moisture', "loss_unit" = 'pct', "loss_amount" = 100 - f."yield_pct"
FROM "formulations" f
WHERE ps."formulation_id" = f."id"
  AND f."yield_pct" < 100
  AND ps."step_no" = (SELECT max(s."step_no") FROM "process_steps" s WHERE s."formulation_id" = f."id");--> statement-breakpoint
INSERT INTO "process_steps" ("formulation_id", "step_no", "instruction", "params", "loss_type", "loss_unit", "loss_amount")
SELECT f."id", 1, 'Process loss (migrated from yield %)', '{}'::jsonb, 'moisture', 'pct', 100 - f."yield_pct"
FROM "formulations" f
WHERE f."yield_pct" < 100
  AND NOT EXISTS (SELECT 1 FROM "process_steps" s WHERE s."formulation_id" = f."id");
