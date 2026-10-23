CREATE TABLE "reverse_wizard_drafts" (
	"formulation_id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reverse_wizard_drafts" ADD CONSTRAINT "reverse_wizard_drafts_formulation_id_formulations_id_fk" FOREIGN KEY ("formulation_id") REFERENCES "public"."formulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- RLS on with deliberately NO policies (anon/authenticated denied; the app role bypasses it) — see 0007.
ALTER TABLE "reverse_wizard_drafts" ENABLE ROW LEVEL SECURITY;
