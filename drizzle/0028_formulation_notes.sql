CREATE TABLE "formulation_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"formulation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"author_email" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "formulation_notes" ADD CONSTRAINT "formulation_notes_formulation_id_formulations_id_fk" FOREIGN KEY ("formulation_id") REFERENCES "public"."formulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "formulation_notes_formulation_idx" ON "formulation_notes" USING btree ("formulation_id");--> statement-breakpoint
-- RLS on with deliberately NO policies (anon/authenticated denied; the app role bypasses it) — see 0007.
ALTER TABLE "formulation_notes" ENABLE ROW LEVEL SECURITY;