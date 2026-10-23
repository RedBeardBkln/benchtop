ALTER TABLE "profiles" ADD COLUMN "preferences" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "cost_unit" text DEFAULT 'kg' NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredient_suppliers" ADD COLUMN "use_for_cost" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "formulations" ADD COLUMN "unit_size_g" numeric(10, 4);--> statement-breakpoint
CREATE UNIQUE INDEX "ingredient_suppliers_cost_link_uniq" ON "ingredient_suppliers" USING btree ("ingredient_id") WHERE "ingredient_suppliers"."use_for_cost";