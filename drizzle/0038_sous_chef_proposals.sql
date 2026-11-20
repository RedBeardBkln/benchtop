CREATE TABLE "sous_chef_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" uuid,
	"formulation_id" uuid NOT NULL,
	"changes" jsonb NOT NULL,
	"preview" jsonb NOT NULL,
	"base_fingerprint" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result_formulation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "sous_chef_proposals_status_chk" CHECK ("sous_chef_proposals"."status" in ('pending', 'applied', 'declined', 'stale'))
);
--> statement-breakpoint
ALTER TABLE "sous_chef_proposals" ADD CONSTRAINT "sous_chef_proposals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sous_chef_proposals" ADD CONSTRAINT "sous_chef_proposals_conversation_id_sous_chef_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."sous_chef_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sous_chef_proposals" ADD CONSTRAINT "sous_chef_proposals_message_id_sous_chef_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."sous_chef_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sous_chef_proposals" ADD CONSTRAINT "sous_chef_proposals_formulation_id_formulations_id_fk" FOREIGN KEY ("formulation_id") REFERENCES "public"."formulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sous_chef_proposals" ADD CONSTRAINT "sous_chef_proposals_result_formulation_id_formulations_id_fk" FOREIGN KEY ("result_formulation_id") REFERENCES "public"."formulations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sous_chef_proposals_conversation_idx" ON "sous_chef_proposals" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "sous_chef_proposals_formulation_idx" ON "sous_chef_proposals" USING btree ("formulation_id");--> statement-breakpoint
-- Server-only table (the app connects as the table owner); deny everything to the Supabase API roles
ALTER TABLE "sous_chef_proposals" ENABLE ROW LEVEL SECURITY;
