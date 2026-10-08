CREATE TABLE "formulation_nfp_panels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"formulation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"rules_version" text NOT NULL,
	"serving_size_g" numeric(10, 4),
	"options" jsonb DEFAULT '{}' NOT NULL,
	"model" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "formulation_nfp_panels" ADD CONSTRAINT "formulation_nfp_panels_formulation_id_formulations_id_fk" FOREIGN KEY ("formulation_id") REFERENCES "public"."formulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "formulation_nfp_panels_formulation_idx" ON "formulation_nfp_panels" USING btree ("formulation_id");
--> statement-breakpoint
-- RLS on with deliberately NO policies (anon/authenticated denied; the app role bypasses it) — see 0007.
ALTER TABLE "formulation_nfp_panels" ENABLE ROW LEVEL SECURITY;
