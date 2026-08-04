import { pgTable, uuid, text, integer, numeric, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { reverseCandidateStatusEnum } from './enums'
import { projects } from './projects'
import { ingredients } from './ingredients'

// Parsed competitor/reference product for reverse-engineering mode
// label_photo_paths: Supabase Storage paths
// parsed_nutrition: { [nutrientName]: { value: number, unit: string } }
// parsed_ingredient_deck: Array<{ position: number, name: string, subIngredients?: string[] }>
export const reverseTargets = pgTable('reverse_targets', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  description: text('description'),
  servingSizeG: numeric('serving_size_g', { precision: 10, scale: 4 }),
  labelPhotoPaths: text('label_photo_paths').array().notNull().default([]),
  // Claude-extracted nutrition values — unconfirmed until userConfirmed = true
  parsedNutrition: jsonb('parsed_nutrition'),
  // Ordered ingredient deck with sub-ingredients
  parsedIngredientDeck: jsonb('parsed_ingredient_deck'),
  // 0.0–1.0 overall parse confidence from Claude
  parseConfidence: numeric('parse_confidence', { precision: 5, scale: 4 }),
  userConfirmed: boolean('user_confirmed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('reverse_targets_project_idx').on(t.projectId),
])

// One candidate per deck position per reverse target; user selects the best match
export const reverseCandidates = pgTable('reverse_candidates', {
  id: uuid('id').primaryKey().defaultRandom(),
  reverseTargetId: uuid('reverse_target_id').notNull().references(() => reverseTargets.id, { onDelete: 'cascade' }),
  deckPosition: integer('deck_position').notNull(),
  candidateIngredientId: uuid('candidate_ingredient_id').notNull().references(() => ingredients.id, { onDelete: 'restrict' }),
  rationale: text('rationale'),
  sourceUrls: text('source_urls').array().notNull().default([]),
  status: reverseCandidateStatusEnum('status').notNull().default('pending'),
}, (t) => [
  index('reverse_candidates_target_idx').on(t.reverseTargetId),
  index('reverse_candidates_ingredient_idx').on(t.candidateIngredientId),
])
