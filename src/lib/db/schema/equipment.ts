import { pgTable, uuid, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// Shared list of process equipment (mixers, ovens, …) that process steps can reference
export const equipment = pgTable('equipment', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Names are unique ignoring case, so "Thermomix" and "thermomix" can't both exist
  uniqueIndex('equipment_name_lower_uq').on(sql`lower(${t.name})`),
])
