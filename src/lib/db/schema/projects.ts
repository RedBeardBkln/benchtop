import { pgTable, uuid, text, numeric, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { projectStatusEnum } from './enums'

// targets jsonb shape: Array<{
//   nutrient: string | null,   // nutrient name or null for custom
//   label: string,             // display label
//   comparator: '<=' | '>=' | '=' | 'range',
//   value: number,
//   valueMax?: number,         // range only
//   unit: string,
//   basis: 'per_serving' | 'per_100g',
// }>
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  client: text('client'),
  objectiveText: text('objective_text'),
  proteinTargetPct: numeric('protein_target_pct', { precision: 6, scale: 3 }),
  targets: jsonb('targets').notNull().default('[]'),
  requiredCerts: text('required_certs').array().notNull().default([]),
  excludedAllergens: text('excluded_allergens').array().notNull().default([]),
  status: projectStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('projects_status_idx').on(t.status),
  index('projects_created_at_idx').on(t.createdAt),
])
