CREATE TABLE "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "process_steps" ADD COLUMN "equipment_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_name_lower_uq" ON "equipment" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "process_steps" ADD CONSTRAINT "process_steps_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Match every other table: RLS on so the table is not exposed through Supabase PostgREST (the app connects directly)
ALTER TABLE "equipment" ENABLE ROW LEVEL SECURITY;
