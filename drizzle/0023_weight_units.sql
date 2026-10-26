ALTER TABLE "ingredients" ADD COLUMN "density_g_per_ml" numeric(10, 5);--> statement-breakpoint
ALTER TABLE "formulation_lines" ADD COLUMN "weight_unit" text;--> statement-breakpoint
ALTER TABLE "formulations" ADD COLUMN "weight_unit" text DEFAULT 'g' NOT NULL;