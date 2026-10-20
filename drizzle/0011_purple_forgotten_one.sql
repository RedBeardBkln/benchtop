CREATE TABLE "intake_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"raw_name" text NOT NULL,
	"quantity" numeric(14, 4),
	"quantity_unit" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"name" text,
	"category" text,
	"subcategory" text,
	"micro_category" text,
	"confidence" text,
	"ai_notes" text,
	"matched_ingredient_id" uuid,
	"imported_ingredient_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "subcategory" text;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "micro_category" text;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "on_hand" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "intake_items" ADD CONSTRAINT "intake_items_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_items" ADD CONSTRAINT "intake_items_matched_ingredient_id_ingredients_id_fk" FOREIGN KEY ("matched_ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_items" ADD CONSTRAINT "intake_items_imported_ingredient_id_ingredients_id_fk" FOREIGN KEY ("imported_ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "intake_items_account_idx" ON "intake_items" USING btree ("account_id","status");--> statement-breakpoint
CREATE INDEX "ingredients_category_idx" ON "ingredients" USING btree ("category");--> statement-breakpoint
-- RLS on with deliberately NO policies (anon/authenticated denied; the app role bypasses it) — see 0007.
ALTER TABLE "intake_items" ENABLE ROW LEVEL SECURITY;
