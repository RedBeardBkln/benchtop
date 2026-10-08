import { pgTable, uuid, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { accounts } from './accounts'

// Per-account list of process equipment (mixers, ovens, …) that process steps can reference
export const equipment = pgTable('equipment', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Names are unique per account ignoring case, so "Thermomix" and "thermomix" can't both exist
  // in one account (different accounts may each have their own)
  uniqueIndex('equipment_account_name_lower_uq').on(t.accountId, sql`lower(${t.name})`),
])
