ALTER TABLE "ingredients" ADD COLUMN "brand_name" text;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "supplier_name" text;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "item_code" text;--> statement-breakpoint
ALTER TABLE "formulations" ADD COLUMN "family_id" uuid;--> statement-breakpoint
-- Existing formulations (including earlier forks) each become their own family, so the Projects list is unchanged
UPDATE "formulations" SET "family_id" = "id";--> statement-breakpoint
ALTER TABLE "formulations" ALTER COLUMN "family_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "formulations_family_version_uq" ON "formulations" USING btree ("family_id","version");