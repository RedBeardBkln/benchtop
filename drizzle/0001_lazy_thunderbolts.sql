CREATE TABLE "ingredient_suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"pack_size" numeric(10, 4),
	"pack_unit" text,
	"cost_per_unit" numeric(10, 4),
	"is_preferred" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"website_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batch_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"formulation_id" uuid NOT NULL,
	"batch_multiplier" numeric(10, 4) DEFAULT '1' NOT NULL,
	"notes" text,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingredient_nutrients" ALTER COLUMN "amount_per_100g" SET DATA TYPE numeric(18, 6);--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "stock_g" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "label_name" text;--> statement-breakpoint
ALTER TABLE "formulations" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ingredient_suppliers" ADD CONSTRAINT "ingredient_suppliers_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_suppliers" ADD CONSTRAINT "ingredient_suppliers_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_runs" ADD CONSTRAINT "batch_runs_formulation_id_formulations_id_fk" FOREIGN KEY ("formulation_id") REFERENCES "public"."formulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingredient_suppliers_ingredient_idx" ON "ingredient_suppliers" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "ingredient_suppliers_supplier_idx" ON "ingredient_suppliers" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "suppliers_name_idx" ON "suppliers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "batch_runs_formulation_idx" ON "batch_runs" USING btree ("formulation_id");