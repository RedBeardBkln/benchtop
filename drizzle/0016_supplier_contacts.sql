CREATE TABLE "supplier_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"email" text,
	"phone" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"notes" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "address" jsonb;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "account_number" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "payment_terms" text;--> statement-breakpoint
ALTER TABLE "supplier_contacts" ADD CONSTRAINT "supplier_contacts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supplier_contacts_supplier_idx" ON "supplier_contacts" USING btree ("supplier_id");--> statement-breakpoint
-- RLS on with deliberately NO policies (anon/authenticated denied; the app role bypasses it) — see 0007.
ALTER TABLE "supplier_contacts" ENABLE ROW LEVEL SECURITY;
