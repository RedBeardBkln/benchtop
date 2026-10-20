import { pgTable, uuid, text, numeric, timestamp, index } from 'drizzle-orm/pg-core'
import { accounts } from './accounts'
import { ingredients } from './ingredients'

// Lab intake: a scratch list of materials typed in (or read off a label photo) while walking the
// shelves. Claude identifies and categorizes the list, then it is uploaded into the ingredient library.
export const intakeItems = pgTable('intake_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  // What the container label says, as entered
  rawName: text('raw_name').notNull(),
  quantity: numeric('quantity', { precision: 14, scale: 4 }),
  quantityUnit: text('quantity_unit'), // one of INTAKE_UNITS
  // 'pending' → 'identified' (Claude has categorized it) → 'imported' (in the library)
  status: text('status').notNull().default('pending'),
  // Filled by Claude, editable before upload
  name: text('name'),
  category: text('category'),
  subcategory: text('subcategory'),
  microCategory: text('micro_category'),
  confidence: text('confidence'), // 'high' | 'medium' | 'low'
  aiNotes: text('ai_notes'),
  // Existing library entry this item is the same material as; upload links to it instead of creating one
  matchedIngredientId: uuid('matched_ingredient_id').references(() => ingredients.id, { onDelete: 'set null' }),
  importedIngredientId: uuid('imported_ingredient_id').references(() => ingredients.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('intake_items_account_idx').on(t.accountId, t.status),
])
