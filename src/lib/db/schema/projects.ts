import { pgTable, uuid, text, numeric, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { projectStatusEnum } from './enums'
import { accounts } from './accounts'
import { clients } from './clients'

// targets jsonb shape: Array<{
//   nutrient: string | null,   // nutrient name or null for custom
//   label: string,             // display label
//   comparator: '<=' | '>=' | '=' | 'range',
//   value: number,
//   valueMax?: number,         // range only
//   unit: string,
//   basis: 'per_serving' | 'per_100g',
//   dryBasis?: boolean,        // per 100 g of dry matter instead of as is (basis is then per_100g)
// }>
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  name: text('name').notNull(),
  // Name copy of the linked client: team access grants match projects by client name
  client: text('client'),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
  objectiveText: text('objective_text'),
  proteinTargetPct: numeric('protein_target_pct', { precision: 6, scale: 3 }),
  targets: jsonb('targets').notNull().default('[]'),
  requiredCerts: text('required_certs').array().notNull().default([]),
  excludedAllergens: text('excluded_allergens').array().notNull().default([]),
  status: projectStatusEnum('status').notNull().default('active'),
  // Set when the project was archived along with its client, so unarchiving the client can offer it back
  archivedWithClientId: uuid('archived_with_client_id').references(() => clients.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('projects_account_idx').on(t.accountId),
  index('projects_status_idx').on(t.status),
  index('projects_created_at_idx').on(t.createdAt),
  index('projects_client_idx').on(t.clientId),
])
