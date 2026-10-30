ALTER TABLE "sous_chef_conversations" ADD COLUMN "formulation_family_id" uuid;--> statement-breakpoint
UPDATE "sous_chef_conversations" c SET "formulation_family_id" = f."family_id" FROM "formulations" f WHERE f."id" = c."formulation_id";
