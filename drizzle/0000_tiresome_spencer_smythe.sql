CREATE TYPE "public"."formulation_mode" AS ENUM('ground_up', 'reverse');--> statement-breakpoint
CREATE TYPE "public"."formulation_status" AS ENUM('draft', 'locked');--> statement-breakpoint
CREATE TYPE "public"."nutrient_category" AS ENUM('macros', 'vitamins', 'minerals', 'other');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."reverse_candidate_status" AS ENUM('pending', 'selected', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('usda', 'supplier', 'manual', 'ai_extracted');--> statement-breakpoint
CREATE TYPE "public"."target_basis" AS ENUM('per_serving', 'per_100g');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('verified', 'unverified');--> statement-breakpoint
CREATE TABLE "nutrients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"fdc_nutrient_number" integer,
	"daily_value_amount" numeric(12, 6),
	"category" "nutrient_category" DEFAULT 'other' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingredient_allergens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"allergen" text NOT NULL,
	CONSTRAINT "ingredient_allergens_unique" UNIQUE("ingredient_id","allergen")
);
--> statement-breakpoint
CREATE TABLE "ingredient_certs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"cert" text NOT NULL,
	"evidence_doc_id" uuid,
	CONSTRAINT "ingredient_certs_unique" UNIQUE("ingredient_id","cert")
);
--> statement-breakpoint
CREATE TABLE "ingredient_docs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"file_path" text NOT NULL,
	"label" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingredient_nutrients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"nutrient_id" uuid NOT NULL,
	"amount_per_100g" numeric(12, 6) NOT NULL,
	"source_ref" text NOT NULL,
	"source_url" text,
	CONSTRAINT "ingredient_nutrients_unique" UNIQUE("ingredient_id","nutrient_id")
);
--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"source_type" "source_type" DEFAULT 'manual' NOT NULL,
	"fdc_id" integer,
	"fdc_fetched_at" timestamp with time zone,
	"verification" "verification_status" DEFAULT 'unverified' NOT NULL,
	"is_ab_spi" boolean DEFAULT false NOT NULL,
	"is_isolate_or_concentrate" boolean DEFAULT false NOT NULL,
	"naturally_derived" boolean DEFAULT true NOT NULL,
	"default_cost_per_kg" numeric(10, 4),
	"moisture_pct" numeric(6, 4),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sub_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "sub_ingredients_unique" UNIQUE("ingredient_id","position")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"client" text,
	"objective_text" text,
	"protein_target_pct" numeric(6, 3),
	"targets" jsonb DEFAULT '[]' NOT NULL,
	"required_certs" text[] DEFAULT '{}' NOT NULL,
	"excluded_allergens" text[] DEFAULT '{}' NOT NULL,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "formulation_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"formulation_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"weight_g" numeric(12, 4) NOT NULL,
	"pct" numeric(8, 5) NOT NULL,
	"min_pct" numeric(8, 5),
	"max_pct" numeric(8, 5),
	"locked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "formulation_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"formulation_id" uuid NOT NULL,
	"nutrient_id" uuid,
	"label" text,
	"comparator" text NOT NULL,
	"value" numeric(12, 6) NOT NULL,
	"value_max" numeric(12, 6),
	"unit" text NOT NULL,
	"basis" "target_basis" DEFAULT 'per_100g' NOT NULL,
	"snapshot_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "formulations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"parent_formulation_id" uuid,
	"mode" "formulation_mode" DEFAULT 'ground_up' NOT NULL,
	"status" "formulation_status" DEFAULT 'draft' NOT NULL,
	"serving_size_g" numeric(10, 4),
	"batch_size_g" numeric(12, 4),
	"yield_pct" numeric(8, 5) DEFAULT '100.00000' NOT NULL,
	"notes" text,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "process_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"formulation_id" uuid NOT NULL,
	"step_no" integer NOT NULL,
	"instruction" text NOT NULL,
	"params" jsonb DEFAULT '{}' NOT NULL,
	"loss_pct" numeric(6, 4)
);
--> statement-breakpoint
CREATE TABLE "reverse_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reverse_target_id" uuid NOT NULL,
	"deck_position" integer NOT NULL,
	"candidate_ingredient_id" uuid NOT NULL,
	"rationale" text,
	"source_urls" text[] DEFAULT '{}' NOT NULL,
	"status" "reverse_candidate_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reverse_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"description" text,
	"serving_size_g" numeric(10, 4),
	"label_photo_paths" text[] DEFAULT '{}' NOT NULL,
	"parsed_nutrition" jsonb,
	"parsed_ingredient_deck" jsonb,
	"parse_confidence" numeric(5, 4),
	"user_confirmed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid
);
--> statement-breakpoint
ALTER TABLE "ingredient_allergens" ADD CONSTRAINT "ingredient_allergens_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_certs" ADD CONSTRAINT "ingredient_certs_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_certs" ADD CONSTRAINT "ingredient_certs_evidence_doc_id_ingredient_docs_id_fk" FOREIGN KEY ("evidence_doc_id") REFERENCES "public"."ingredient_docs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_docs" ADD CONSTRAINT "ingredient_docs_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_nutrients" ADD CONSTRAINT "ingredient_nutrients_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_nutrients" ADD CONSTRAINT "ingredient_nutrients_nutrient_id_nutrients_id_fk" FOREIGN KEY ("nutrient_id") REFERENCES "public"."nutrients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_ingredients" ADD CONSTRAINT "sub_ingredients_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formulation_lines" ADD CONSTRAINT "formulation_lines_formulation_id_formulations_id_fk" FOREIGN KEY ("formulation_id") REFERENCES "public"."formulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formulation_lines" ADD CONSTRAINT "formulation_lines_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formulation_targets" ADD CONSTRAINT "formulation_targets_formulation_id_formulations_id_fk" FOREIGN KEY ("formulation_id") REFERENCES "public"."formulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formulation_targets" ADD CONSTRAINT "formulation_targets_nutrient_id_nutrients_id_fk" FOREIGN KEY ("nutrient_id") REFERENCES "public"."nutrients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formulations" ADD CONSTRAINT "formulations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formulations" ADD CONSTRAINT "formulations_parent_fk" FOREIGN KEY ("parent_formulation_id") REFERENCES "public"."formulations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_steps" ADD CONSTRAINT "process_steps_formulation_id_formulations_id_fk" FOREIGN KEY ("formulation_id") REFERENCES "public"."formulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reverse_candidates" ADD CONSTRAINT "reverse_candidates_reverse_target_id_reverse_targets_id_fk" FOREIGN KEY ("reverse_target_id") REFERENCES "public"."reverse_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reverse_candidates" ADD CONSTRAINT "reverse_candidates_candidate_ingredient_id_ingredients_id_fk" FOREIGN KEY ("candidate_ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reverse_targets" ADD CONSTRAINT "reverse_targets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nutrients_display_order_idx" ON "nutrients" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "nutrients_fdc_number_idx" ON "nutrients" USING btree ("fdc_nutrient_number");--> statement-breakpoint
CREATE INDEX "ingredient_allergens_ingredient_idx" ON "ingredient_allergens" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "ingredient_certs_ingredient_idx" ON "ingredient_certs" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "ingredient_docs_ingredient_idx" ON "ingredient_docs" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "ingredient_nutrients_ingredient_idx" ON "ingredient_nutrients" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "ingredient_nutrients_nutrient_idx" ON "ingredient_nutrients" USING btree ("nutrient_id");--> statement-breakpoint
CREATE INDEX "ingredients_name_idx" ON "ingredients" USING btree ("name");--> statement-breakpoint
CREATE INDEX "ingredients_fdc_id_idx" ON "ingredients" USING btree ("fdc_id");--> statement-breakpoint
CREATE INDEX "ingredients_is_ab_spi_idx" ON "ingredients" USING btree ("is_ab_spi");--> statement-breakpoint
CREATE INDEX "sub_ingredients_ingredient_idx" ON "sub_ingredients" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "projects_created_at_idx" ON "projects" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "formulation_lines_formulation_idx" ON "formulation_lines" USING btree ("formulation_id");--> statement-breakpoint
CREATE INDEX "formulation_lines_ingredient_idx" ON "formulation_lines" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "formulation_targets_formulation_idx" ON "formulation_targets" USING btree ("formulation_id");--> statement-breakpoint
CREATE INDEX "formulations_project_idx" ON "formulations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "formulations_parent_idx" ON "formulations" USING btree ("parent_formulation_id");--> statement-breakpoint
CREATE INDEX "process_steps_formulation_idx" ON "process_steps" USING btree ("formulation_id");--> statement-breakpoint
CREATE INDEX "reverse_candidates_target_idx" ON "reverse_candidates" USING btree ("reverse_target_id");--> statement-breakpoint
CREATE INDEX "reverse_candidates_ingredient_idx" ON "reverse_candidates" USING btree ("candidate_ingredient_id");--> statement-breakpoint
CREATE INDEX "reverse_targets_project_idx" ON "reverse_targets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "audit_log_user_idx" ON "audit_log" USING btree ("user_id");