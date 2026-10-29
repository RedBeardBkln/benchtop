CREATE TABLE "sous_chef_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"project_id" uuid,
	"formulation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sous_chef_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"activity" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sous_chef_messages_role_chk" CHECK ("sous_chef_messages"."role" in ('user', 'assistant'))
);
--> statement-breakpoint
CREATE TABLE "sous_chef_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"kind" text NOT NULL,
	"content" text NOT NULL,
	"project_id" uuid,
	"formulation_id" uuid,
	"conversation_id" uuid,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sous_chef_notes_kind_chk" CHECK ("sous_chef_notes"."kind" in ('decision', 'preference', 'learning', 'constraint'))
);
--> statement-breakpoint
ALTER TABLE "sous_chef_conversations" ADD CONSTRAINT "sous_chef_conversations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sous_chef_conversations" ADD CONSTRAINT "sous_chef_conversations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sous_chef_conversations" ADD CONSTRAINT "sous_chef_conversations_formulation_id_formulations_id_fk" FOREIGN KEY ("formulation_id") REFERENCES "public"."formulations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sous_chef_messages" ADD CONSTRAINT "sous_chef_messages_conversation_id_sous_chef_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."sous_chef_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sous_chef_notes" ADD CONSTRAINT "sous_chef_notes_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sous_chef_notes" ADD CONSTRAINT "sous_chef_notes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sous_chef_notes" ADD CONSTRAINT "sous_chef_notes_formulation_id_formulations_id_fk" FOREIGN KEY ("formulation_id") REFERENCES "public"."formulations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sous_chef_notes" ADD CONSTRAINT "sous_chef_notes_conversation_id_sous_chef_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."sous_chef_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sous_chef_conversations_user_idx" ON "sous_chef_conversations" USING btree ("account_id","user_id","updated_at");--> statement-breakpoint
CREATE INDEX "sous_chef_messages_conversation_idx" ON "sous_chef_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "sous_chef_notes_account_idx" ON "sous_chef_notes" USING btree ("account_id","created_at");--> statement-breakpoint
-- RLS on with deliberately NO policies (anon/authenticated denied; the app role bypasses it) — see 0007.
ALTER TABLE "sous_chef_conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sous_chef_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sous_chef_notes" ENABLE ROW LEVEL SECURITY;
