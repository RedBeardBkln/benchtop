ALTER TYPE "public"."source_type" ADD VALUE 'formulation';--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "source_formulation_id" uuid;--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_source_formulation_id_formulations_id_fk" FOREIGN KEY ("source_formulation_id") REFERENCES "public"."formulations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingredients_source_formulation_idx" ON "ingredients" USING btree ("source_formulation_id");