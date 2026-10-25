ALTER TABLE "ingredients" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "archived_with_client_id" uuid;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "archived_with_client_id" uuid;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "archived_with_client_id" uuid;--> statement-breakpoint
ALTER TABLE "formulations" ADD COLUMN "archived_with_client_id" uuid;--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_archived_with_client_id_clients_id_fk" FOREIGN KEY ("archived_with_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_archived_with_client_id_clients_id_fk" FOREIGN KEY ("archived_with_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_archived_with_client_id_clients_id_fk" FOREIGN KEY ("archived_with_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formulations" ADD CONSTRAINT "formulations_archived_with_client_id_clients_id_fk" FOREIGN KEY ("archived_with_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;